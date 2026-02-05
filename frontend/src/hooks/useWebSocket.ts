import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { useNotificationStore } from '@/store/notificationStore'

interface WebSocketMessage {
  event: 'connected' | 'session.new' | 'session.lost' | 'beacon.new' | 'beacon.checkin' | 'task_completed' | 'notification' | 'ping' | 'pong' | 'subscribed' | 'error'
  data?: any
}

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const getWebSocketUrl = useCallback(() => {
    // Token is stored in zustand persist storage as 'sliverui-auth'
    let token = null
    try {
      const authData = localStorage.getItem('sliverui-auth')
      if (authData) {
        const parsed = JSON.parse(authData)
        token = parsed.state?.accessToken || null
      }
    } catch (e) {
      console.error('Failed to parse auth data:', e)
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // WebSocket endpoint is at /ws (not /api/v1/ws)
    return `${protocol}//${host}/ws?token=${token}`
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    const addNotification = useNotificationStore.getState().addNotification

    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      setLastMessage(message)

      switch (message.event) {
        case 'connected':
          console.log('WebSocket connected, sliver status:', message.data?.sliver_connected)
          break

        case 'session.new':
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
          toast({
            title: 'New Session Connected',
            description: `${message.data?.name || message.data?.id} connected from ${message.data?.remote_address || 'unknown'}`,
          })
          addNotification({
            type: 'session',
            title: 'New Session',
            message: `${message.data?.name || message.data?.id} connected from ${message.data?.remote_address || 'unknown'}`,
            data: message.data,
          })
          break

        case 'session.lost':
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
          toast({
            variant: 'destructive',
            title: 'Session Disconnected',
            description: `Session ${message.data?.id} has disconnected`,
          })
          addNotification({
            type: 'warning',
            title: 'Session Disconnected',
            message: `Session ${message.data?.id} has disconnected`,
            data: message.data,
          })
          break

        case 'beacon.new':
          queryClient.invalidateQueries({ queryKey: ['beacons'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
          toast({
            title: 'New Beacon',
            description: `${message.data?.name || message.data?.id} first check-in`,
          })
          addNotification({
            type: 'beacon',
            title: 'New Beacon',
            message: `${message.data?.name || message.data?.id} first check-in from ${message.data?.remote_address || 'unknown'}`,
            data: message.data,
          })
          break

        case 'beacon.checkin':
          queryClient.invalidateQueries({ queryKey: ['beacons'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
          break

        case 'task_completed':
          queryClient.invalidateQueries({ queryKey: ['beacon-tasks', message.data?.beacon_id] })
          toast({
            title: 'Task Completed',
            description: `Task ${message.data?.task_type} completed for beacon ${message.data?.beacon_name}`,
          })
          addNotification({
            type: 'info',
            title: 'Task Completed',
            message: `Task ${message.data?.task_type} completed for ${message.data?.beacon_name}`,
            data: message.data,
          })
          break

        case 'notification':
          toast({
            title: message.data?.title,
            description: message.data?.message,
            variant: message.data?.variant || 'default',
          })
          addNotification({
            type: message.data?.variant === 'destructive' ? 'error' : 'info',
            title: message.data?.title,
            message: message.data?.message,
            data: message.data,
          })
          break

        case 'ping':
          // Respond to server ping
          break

        case 'pong':
        case 'subscribed':
        case 'error':
          // Handle other events silently
          if (message.event === 'error') {
            console.error('WebSocket error:', message.data?.message)
          }
          break

        default:
          console.log('Unknown WebSocket event:', message.event)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }, [queryClient, toast])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Token is stored in zustand persist storage as 'sliverui-auth'
    let token = null
    try {
      const authData = localStorage.getItem('sliverui-auth')
      if (authData) {
        const parsed = JSON.parse(authData)
        token = parsed.state?.accessToken || null
      }
    } catch (e) {
      // Ignore parse errors
    }
    if (!token) {
      console.log('No token available for WebSocket connection')
      return
    }

    try {
      const ws = new WebSocket(getWebSocketUrl())

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        reconnectCountRef.current = 0
      }

      ws.onmessage = handleMessage

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          console.log(`Attempting reconnection ${reconnectCountRef.current}/${reconnectAttempts}`)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [getWebSocketUrl, handleMessage, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect')
      wsRef.current = null
    }

    setIsConnected(false)
  }, [])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sliverui-auth') {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue)
            if (parsed.state?.accessToken) {
              disconnect()
              setTimeout(connect, 100)
            } else {
              disconnect()
            }
          } catch {
            disconnect()
          }
        } else {
          disconnect()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [connect, disconnect])

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    send,
  }
}
