import { useState, useEffect, useCallback } from 'react'
import { emqxApi } from '../services/emqxApi'

export const useEmqxData = () => {
  const [clusterInfo, setClusterInfo] = useState(null)
  const [clients, setClients] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [clusterData, clientsData, subscriptionsData, nodesData] = await Promise.all([
        emqxApi.getClusterInfo(),
        emqxApi.getConnectedClients(),
        emqxApi.getSubscriptions(),
        emqxApi.getNodes()
      ])

      setClusterInfo(clusterData)
      setClients(clientsData.data || [])
      setSubscriptions(subscriptionsData.data || [])
      setNodes(nodesData.data || [])
    } catch (err) {
      setError(err.message || 'Error al conectar con EMQX')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Refrescar datos cada 10 segundos
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  return {
    clusterInfo,
    clients,
    subscriptions,
    nodes,
    loading,
    error,
    refetch: fetchData
  }
}
