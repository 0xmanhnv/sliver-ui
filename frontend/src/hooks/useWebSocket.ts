import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'
import { useNotificationStore } from '@/store/notificationStore'

interface WebSocketMessage {
  event: 'connected' | 'session.new' | 'session.lost' | 'beacon.new' | 'beacon.checkin' | 'task_completed' | 'notification' | 'ping' | 'pong' | 'subscribed' | 'error'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

function getToken(): string | null {
  try {
    const authData = localStorage.getItem('sliverui-auth')
    if (authData) {
      const parsed = JSON.parse(authData)
      return parsed.state?.accessToken || null
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

function buildWebSocketUrl(): string {
  const token = getToken()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws?token=${token}`
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

  // Main connection effect — handles connect, message handling, reconnect, cleanup
  useEffect(() => {
    if (!autoConnect) return

    let disposed = false

    function handleMessage(event: MessageEvent) {
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
            break

          case 'pong':
          case 'subscribed':
          case 'error':
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
    }

    function openConnection() {
      if (disposed) return
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const token = getToken()
      if (!token) {
        console.log('No token available for WebSocket connection')
        return
      }

      try {
        const ws = new WebSocket(buildWebSocketUrl())

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

          if (!disposed && event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
            reconnectCountRef.current++
            console.log(`Attempting reconnection ${reconnectCountRef.current}/${reconnectAttempts}`)
            reconnectTimeoutRef.current = setTimeout(openConnection, reconnectInterval)
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
      }
    }

    openConnection()

    // Listen for token changes (e.g. login/logout in another tab)
    function handleStorageChange(e: StorageEvent) {
      if (e.key !== 'sliverui-auth') return

      // Close existing connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Token changed')
        wsRef.current = null
      }
      setIsConnected(false)

      // Reconnect if new token exists
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.state?.accessToken) {
            reconnectCountRef.current = 0
            setTimeout(openConnection, 100)
          }
        } catch {
          // Ignore
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      disposed = true
      window.removeEventListener('storage', handleStorageChange)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
        wsRef.current = null
      }
      setIsConnected(false)
    }
  }, [autoConnect, reconnectAttempts, reconnectInterval, queryClient, toast])

  const connect = useCallback(() => {
    // Force reconnect: close existing, reset counter, re-trigger effect won't work
    // so we do it imperatively via the ref
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect')
      wsRef.current = null
    }
    reconnectCountRef.current = 0

    const token = getToken()
    if (!token) return

    try {
      const ws = new WebSocket(buildWebSocketUrl())
      ws.onopen = () => {
        setIsConnected(true)
        reconnectCountRef.current = 0
      }
      ws.onerror = (error) => console.error('WebSocket error:', error)
      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
      }
      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [])

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    send,
  }
}
