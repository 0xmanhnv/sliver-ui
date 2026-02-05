import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus,
  RefreshCw,
  Loader2,
  Network,
  ArrowRightLeft,
  Trash2,
  Globe,
  Server,
  Copy,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Pivot {
  id: string
  type: 'socks5' | 'portfwd'
  host?: string
  port?: number
  local_host?: string
  local_port?: number
  remote_host?: string
  remote_port?: number
}

interface PivotManagerProps {
  sessionId: string
  sessionName?: string
}

type PivotType = 'socks5' | 'portfwd'

export function PivotManager({ sessionId, sessionName }: PivotManagerProps) {
  const [showNewPivot, setShowNewPivot] = useState(false)
  const [pivotType, setPivotType] = useState<PivotType>('socks5')

  // SOCKS form state
  const [socksHost, setSocksHost] = useState('127.0.0.1')
  const [socksPort, setSocksPort] = useState('1080')

  // Port forward form state
  const [localHost, setLocalHost] = useState('127.0.0.1')
  const [localPort, setLocalPort] = useState('')
  const [remoteHost, setRemoteHost] = useState('')
  const [remotePort, setRemotePort] = useState('')

  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch pivots
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pivots', sessionId],
    queryFn: () => sessionsApi.listPivots(sessionId),
    enabled: !!sessionId,
    refetchInterval: 10000,
  })

  // Start SOCKS proxy mutation
  const startSocksMutation = useMutation({
    mutationFn: ({ host, port }: { host: string; port: number }) =>
      sessionsApi.startSocks(sessionId, host, port),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pivots', sessionId] })
      toast({ title: `SOCKS5 proxy started on ${result.host}:${result.port}` })
      setShowNewPivot(false)
      resetForm()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start SOCKS proxy',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Stop SOCKS proxy mutation
  const stopSocksMutation = useMutation({
    mutationFn: (tunnelId: number) => sessionsApi.stopSocks(sessionId, tunnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pivots', sessionId] })
      toast({ title: 'SOCKS proxy stopped' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop SOCKS proxy',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Start port forward mutation
  const startPortfwdMutation = useMutation({
    mutationFn: (config: {
      remoteHost: string
      remotePort: number
      localHost: string
      localPort: number
    }) =>
      sessionsApi.startPortfwd(
        sessionId,
        config.remoteHost,
        config.remotePort,
        config.localHost,
        config.localPort
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pivots', sessionId] })
      toast({
        title: `Port forward started`,
        description: `${result.local_host}:${result.local_port} -> ${result.remote_host}:${result.remote_port}`,
      })
      setShowNewPivot(false)
      resetForm()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start port forward',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Stop port forward mutation
  const stopPortfwdMutation = useMutation({
    mutationFn: (tunnelId: number) => sessionsApi.stopPortfwd(sessionId, tunnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pivots', sessionId] })
      toast({ title: 'Port forward stopped' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop port forward',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const resetForm = () => {
    setSocksHost('127.0.0.1')
    setSocksPort('1080')
    setLocalHost('127.0.0.1')
    setLocalPort('')
    setRemoteHost('')
    setRemotePort('')
  }

  const handleStartPivot = () => {
    if (pivotType === 'socks5') {
      startSocksMutation.mutate({
        host: socksHost,
        port: parseInt(socksPort) || 1080,
      })
    } else {
      startPortfwdMutation.mutate({
        remoteHost,
        remotePort: parseInt(remotePort),
        localHost,
        localPort: parseInt(localPort) || 0,
      })
    }
  }

  const handleStopPivot = (pivot: Pivot) => {
    const tunnelId = parseInt(pivot.id)
    if (pivot.type === 'socks5') {
      stopSocksMutation.mutate(tunnelId)
    } else {
      stopPortfwdMutation.mutate(tunnelId)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  const pivots: Pivot[] = data?.pivots || []
  const socksPivots = pivots.filter((p) => p.type === 'socks5')
  const portfwdPivots = pivots.filter((p) => p.type === 'portfwd')

  const isPending =
    startSocksMutation.isPending ||
    startPortfwdMutation.isPending ||
    stopSocksMutation.isPending ||
    stopPortfwdMutation.isPending

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Network className="h-5 w-5" />
        <h3 className="font-medium">Pivoting</h3>
        <span className="text-sm text-muted-foreground">
          {pivots.length} active tunnel{pivots.length !== 1 ? 's' : ''}
        </span>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setShowNewPivot(!showNewPivot)}>
          <Plus className="h-4 w-4 mr-1" />
          New Tunnel
        </Button>
      </div>

      {/* New pivot form */}
      {showNewPivot && (
        <div className="p-4 border-b bg-muted/30 space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={pivotType === 'socks5' ? 'default' : 'outline'}
              onClick={() => setPivotType('socks5')}
            >
              <Shield className="h-4 w-4 mr-1" />
              SOCKS5 Proxy
            </Button>
            <Button
              size="sm"
              variant={pivotType === 'portfwd' ? 'default' : 'outline'}
              onClick={() => setPivotType('portfwd')}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              Port Forward
            </Button>
          </div>

          {pivotType === 'socks5' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Create a SOCKS5 proxy on your local machine that tunnels through this session.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Bind Host</label>
                  <Input
                    value={socksHost}
                    onChange={(e) => setSocksHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Bind Port</label>
                  <Input
                    value={socksPort}
                    onChange={(e) => setSocksPort(e.target.value)}
                    placeholder="1080"
                    type="number"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 text-sm">
                <p className="font-medium text-blue-600 dark:text-blue-400">Usage:</p>
                <code className="text-xs">
                  curl --socks5 {socksHost}:{socksPort} http://internal-host/
                </code>
                <br />
                <code className="text-xs">
                  proxychains -q nmap -sT internal-host
                </code>
              </div>
            </div>
          )}

          {pivotType === 'portfwd' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Forward a local port to a remote host through this session.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Local Host</label>
                  <Input
                    value={localHost}
                    onChange={(e) => setLocalHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Local Port</label>
                  <Input
                    value={localPort}
                    onChange={(e) => setLocalPort(e.target.value)}
                    placeholder="Auto-assign"
                    type="number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Remote Host</label>
                  <Input
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="192.168.1.100"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Remote Port</label>
                  <Input
                    value={remotePort}
                    onChange={(e) => setRemotePort(e.target.value)}
                    placeholder="22"
                    type="number"
                    className="mt-1"
                  />
                </div>
              </div>
              {remoteHost && remotePort && (
                <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400">After starting:</p>
                  <code className="text-xs">
                    ssh user@{localHost} -p {localPort || '[auto]'} # connects to {remoteHost}:{remotePort}
                  </code>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleStartPivot}
              disabled={
                isPending ||
                (pivotType === 'portfwd' && (!remoteHost || !remotePort))
              }
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Start Tunnel
            </Button>
            <Button variant="outline" onClick={() => setShowNewPivot(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Pivot list */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : pivots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Network className="h-12 w-12 mb-2 opacity-30" />
            <p>No active tunnels</p>
            <p className="text-sm">Create a SOCKS proxy or port forward to pivot through this session</p>
          </div>
        ) : (
          <>
            {/* SOCKS Proxies */}
            {socksPivots.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  SOCKS5 Proxies
                </h4>
                <div className="space-y-2">
                  {socksPivots.map((pivot) => (
                    <div
                      key={pivot.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Shield className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {pivot.host}:{pivot.port}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-600">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          SOCKS5 proxy • Tunnel ID: {pivot.id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(`socks5://${pivot.host}:${pivot.port}`)
                        }
                        title="Copy proxy URL"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleStopPivot(pivot)}
                        disabled={isPending}
                        title="Stop proxy"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Port Forwards */}
            {portfwdPivots.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Port Forwards
                </h4>
                <div className="space-y-2">
                  {portfwdPivots.map((pivot) => (
                    <div
                      key={pivot.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {pivot.local_host}:{pivot.local_port}
                          </span>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {pivot.remote_host}:{pivot.remote_port}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-600">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Port forward • Tunnel ID: {pivot.id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            `${pivot.local_host}:${pivot.local_port} -> ${pivot.remote_host}:${pivot.remote_port}`
                          )
                        }
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleStopPivot(pivot)}
                        disabled={isPending}
                        title="Stop forward"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground">
        <p>
          <strong>Tip:</strong> Use SOCKS proxy to route tools through the session.
          Use port forwards for specific services.
        </p>
      </div>
    </div>
  )
}
