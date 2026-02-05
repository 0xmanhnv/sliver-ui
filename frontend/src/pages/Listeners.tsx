import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listenersApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Antenna, RefreshCw, Plus, Trash2, Loader2 } from 'lucide-react'

export function Listeners() {
  const [showForm, setShowForm] = useState(false)
  const [protocol, setProtocol] = useState('mtls')
  const [host, setHost] = useState('0.0.0.0')
  const [port, setPort] = useState(443)
  const [domain, setDomain] = useState('')

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['listeners'],
    queryFn: listenersApi.list,
    refetchInterval: 30000,
  })

  const startMtlsMutation = useMutation({
    mutationFn: () => listenersApi.startMtls(host, port),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listeners'] })
      toast({ title: 'mTLS listener started' })
      setShowForm(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start listener',
        description: error.response?.data?.detail,
      })
    },
  })

  const startHttpsMutation = useMutation({
    mutationFn: () =>
      listenersApi.startHttps({ host, port, domain, letsencrypt: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listeners'] })
      toast({ title: 'HTTPS listener started' })
      setShowForm(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start listener',
        description: error.response?.data?.detail,
      })
    },
  })

  const startHttpMutation = useMutation({
    mutationFn: () => listenersApi.startHttp({ host, port, domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listeners'] })
      toast({ title: 'HTTP listener started' })
      setShowForm(false)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start listener',
        description: error.response?.data?.detail,
      })
    },
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => listenersApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listeners'] })
      toast({ title: 'Listener stopped' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop listener',
        description: error.response?.data?.detail,
      })
    },
  })

  const listeners = data?.listeners || []

  const handleStart = () => {
    switch (protocol) {
      case 'mtls':
        startMtlsMutation.mutate()
        break
      case 'https':
        startHttpsMutation.mutate()
        break
      case 'http':
        startHttpMutation.mutate()
        break
    }
  }

  const isStarting =
    startMtlsMutation.isPending ||
    startHttpsMutation.isPending ||
    startHttpMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Listeners</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Listener
          </Button>
        </div>
      </div>

      {/* New Listener Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Listener</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Protocol */}
            <div>
              <label className="text-sm font-medium">Protocol</label>
              <div className="flex gap-2 mt-1">
                {['mtls', 'https', 'http', 'dns'].map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={protocol === p ? 'default' : 'outline'}
                    onClick={() => {
                      setProtocol(p)
                      if (p === 'mtls') setPort(8888)
                      else if (p === 'https') setPort(443)
                      else if (p === 'http') setPort(80)
                      else if (p === 'dns') setPort(53)
                    }}
                  >
                    {p.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Host</label>
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="0.0.0.0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Port</label>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value))}
                />
              </div>
            </div>

            {(protocol === 'https' || protocol === 'http') && (
              <div>
                <label className="text-sm font-medium">Domain (optional)</label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleStart} disabled={isStarting}>
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Listener'
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Listeners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Antenna className="h-5 w-5" />
            Active Listeners ({listeners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : listeners.length === 0 ? (
            <p className="text-muted-foreground">No active listeners</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {listeners.map((listener: any) => (
                <div
                  key={listener.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-medium uppercase">
                        {listener.protocol}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => stopMutation.mutate(listener.id)}
                      disabled={stopMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {/* Show domain prominently if available */}
                  {listener.domain ? (
                    <>
                      <p className="text-lg font-semibold text-primary">
                        {listener.domain}
                      </p>
                      <p className="text-sm font-mono text-muted-foreground">
                        {listener.host || '0.0.0.0'}:{listener.port}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-mono">
                      {listener.host || '0.0.0.0'}:{listener.port}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    ID: {listener.id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
