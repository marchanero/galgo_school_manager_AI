import { useState, useEffect, useCallback } from 'react'

const API_BASE = '/api/emqx'

/**
 * useMQTTData - Custom hook for EMQX data fetching
 * 
 * Handles all API calls to EMQX endpoints with automatic polling.
 * Centralizes data fetching logic that was previously scattered in MQTTConfig.
 * 
 * @returns {Object} EMQX data and methods
 */
export function useMQTTData() {
  // Data states
  const [health, setHealth] = useState(null)
  const [stats, setStats] = useState(null)
  const [clients, setClients] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [topics, setTopics] = useState([])
  const [nodes, setNodes] = useState([])
  const [listeners, setListeners] = useState([])
  const [alarms, setAlarms] = useState([])
  const [servers, setServers] = useState([])
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Load all EMQX data
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [
        healthRes,
        statsRes,
        clientsRes,
        subscriptionsRes,
        topicsRes,
        nodesRes,
        listenersRes,
        alarmsRes,
        serversRes
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/health`).then(r => r.json()),
        fetch(`${API_BASE}/stats`).then(r => r.json()),
        fetch(`${API_BASE}/clients`).then(r => r.json()),
        fetch(`${API_BASE}/subscriptions`).then(r => r.json()),
        fetch(`${API_BASE}/topics`).then(r => r.json()),
        fetch(`${API_BASE}/nodes`).then(r => r.json()),
        fetch(`${API_BASE}/listeners`).then(r => r.json()),
        fetch(`${API_BASE}/alarms`).then(r => r.json()),
        fetch(`${API_BASE}/servers`).then(r => r.json())
      ])

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value?.data || [])
      if (subscriptionsRes.status === 'fulfilled') setSubscriptions(subscriptionsRes.value?.data || [])
      if (topicsRes.status === 'fulfilled') setTopics(topicsRes.value?.data || [])
      if (nodesRes.status === 'fulfilled') setNodes(nodesRes.value || [])
      if (listenersRes.status === 'fulfilled') setListeners(listenersRes.value || [])
      if (alarmsRes.status === 'fulfilled') setAlarms(alarmsRes.value?.data || [])
      if (serversRes.status === 'fulfilled') setServers(serversRes.value?.data || [])

    } catch (error) {
      console.error('Error cargando datos EMQX:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Reload only servers data
   */
  const reloadServers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/servers`)
      const data = await response.json()
      if (data?.data) {
        setServers(data.data)
      }
    } catch (error) {
      console.error('Error recargando servidores:', error)
    }
  }, [])

  /**
   * Auto-load data on mount and set up polling
   */
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [loadData])

  return {
    // Data
    health,
    stats,
    clients,
    subscriptions,
    topics,
    nodes,
    listeners,
    alarms,
    servers,
    
    // State
    isLoading,
    
    // Methods
    loadData,
    reloadServers
  }
}
