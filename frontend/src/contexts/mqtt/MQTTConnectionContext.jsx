import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import mqtt from 'mqtt'
import axios from 'axios'

const MQTTConnectionContext = createContext()

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * MQTTConnectionProvider - Maneja conexión y reconexión al broker MQTT
 * 
 * Responsabilidades:
 * - Configuración del broker
 * - Conexión/desconexión
 * - Estrategia de reconnect con exponential backoff
 * - Estado de conexión
 */
export function MQTTConnectionProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState(null)
    const [config, setConfig] = useState(null)
    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [reconnectState, setReconnectState] = useState({
        attempts: 0,
        isReconnecting: false,
        nextRetryIn: null
    })

    const clientRef = useRef(null)
    const reconnectTimerRef = useRef(null)

    // Backoff configuration
    const backoffConfig = {
        baseDelay: 1000,
        maxDelay: 60000,
        maxRetries: 10,
        multiplier: 2
    }

    const backoffStateRef = useRef({
        attempts: 0,
        currentDelay: backoffConfig.baseDelay
    })

    /**
     * Fetch MQTT config from backend
     */
    const fetchConfig = useCallback(async () => {
        try {
            setIsLoadingConfig(true)
            const response = await axios.get(`${API_BASE}/api/mqtt/config`)

            if (response.data.success) {
                setConfig(response.data.data)
                console.log('✅ Configuración MQTT cargada:', response.data.data.wsUrl)
                return response.data.data
            }
        } catch (err) {
            console.warn('⚠️ Usando configuración por defecto:', err.message)
            const defaultConfig = {
                wsUrl: import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt',
                username: '',
                hasPassword: false
            }
            setConfig(defaultConfig)
            return defaultConfig
        } finally {
            setIsLoadingConfig(false)
        }
    }, [])

    /**
     * Calculate next delay with exponential backoff
     */
    const calculateNextDelay = useCallback(() => {
        const { currentDelay } = backoffStateRef.current
        const jitter = Math.random() * 0.3 + 0.85
        const nextDelay = Math.min(currentDelay * backoffConfig.multiplier * jitter, backoffConfig.maxDelay)
        return Math.round(nextDelay)
    }, [])

    /**
     * Reset backoff state
     */
    const resetBackoff = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
        }
        backoffStateRef.current = {
            attempts: 0,
            currentDelay: backoffConfig.baseDelay
        }
        setReconnectState({
            attempts: 0,
            isReconnecting: false,
            nextRetryIn: null
        })
    }, [])

    /**
     * Schedule reconnection with backoff
     */
    const scheduleReconnect = useCallback(() => {
        const { attempts } = backoffStateRef.current

        if (attempts >= backoffConfig.maxRetries) {
            console.error(`❌ MQTT: Máximo de reintentos alcanzado (${backoffConfig.maxRetries})`)
            setReconnectState(prev => ({ ...prev, isReconnecting: false }))
            return
        }

        const delay = calculateNextDelay()
        backoffStateRef.current.currentDelay = delay
        backoffStateRef.current.attempts++

        console.log(`🔄 MQTT: Reconexión en ${delay}ms (intento ${backoffStateRef.current.attempts}/${backoffConfig.maxRetries})`)

        setReconnectState({
            attempts: backoffStateRef.current.attempts,
            isReconnecting: true,
            nextRetryIn: delay
        })

        reconnectTimerRef.current = setTimeout(async () => {
            try {
                await connect()
                resetBackoff()
                console.log('✅ MQTT: Reconexión exitosa')
            } catch (err) {
                console.error('❌ MQTT: Reconexión fallida:', err.message)
                scheduleReconnect()
            }
        }, delay)
    }, [calculateNextDelay, resetBackoff])

    /**
     * Connect to MQTT broker
     */
    const connect = useCallback(async () => {
        if (clientRef.current?.connected) {
            console.log('✅ Ya conectado a MQTT')
            return clientRef.current
        }

        let mqttConfig = config
        if (!mqttConfig) {
            mqttConfig = await fetchConfig()
        }

        if (!mqttConfig?.wsUrl) {
            console.error('❌ No hay URL de WebSocket MQTT configurada')
            setError('Configuración MQTT no disponible')
            throw new Error('No MQTT config')
        }

        try {
            console.log('🔌 Conectando a MQTT:', mqttConfig.wsUrl)
            setError(null)

            const client = mqtt.connect(mqttConfig.wsUrl, {
                username: mqttConfig.username || '',
                password: '',
                clientId: `camera_rtsp_frontend_${Date.now()}`,
                clean: true,
                reconnectPeriod: 0, // Use custom backoff
                connectTimeout: 30000
            })

            client.on('connect', () => {
                console.log('✅ Conectado a MQTT broker')
                setIsConnected(true)
                setError(null)
                resetBackoff()
            })

            client.on('error', (err) => {
                console.error('❌ MQTT Error:', err.message)
                setError(err.message)
            })

            client.on('close', () => {
                console.log('🔌 MQTT desconectado')
                setIsConnected(false)
                if (!clientRef.current?.reconnecting) {
                    scheduleReconnect()
                }
            })

            client.on('offline', () => {
                console.log('📴 MQTT offline')
                setIsConnected(false)
            })

            clientRef.current = client
            return client

        } catch (err) {
            console.error('❌ Error conectando a MQTT:', err.message)
            setError(err.message)
            scheduleReconnect()
            throw err
        }
    }, [config, fetchConfig, resetBackoff, scheduleReconnect])

    /**
     * Disconnect from broker
     */
    const disconnect = useCallback(() => {
        if (clientRef.current) {
            console.log('🔌 Desconectando MQTT...')
            clientRef.current.end(false, () => {
                console.log('✅ MQTT desconectado limpiamente')
            })
            clientRef.current = null
            setIsConnected(false)
            resetBackoff()
        }
    }, [resetBackoff])

    /**
     * Get MQTT client reference
     */
    const getClient = useCallback(() => {
        return clientRef.current
    }, [])

    const value = {
        isConnected,
        error,
        config,
        isLoadingConfig,
        reconnectState,
        connect,
        disconnect,
        getClient,
        fetchConfig
    }

    return (
        <MQTTConnectionContext.Provider value={value}>
            {children}
        </MQTTConnectionContext.Provider>
    )
}

export function useMQTTConnection() {
    const context = useContext(MQTTConnectionContext)
    if (context === undefined) {
        throw new Error('useMQTTConnection must be used within MQTTConnectionProvider')
    }
    return context
}
