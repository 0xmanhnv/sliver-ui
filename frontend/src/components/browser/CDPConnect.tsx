import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Monitor,
  Loader2,
  ClipboardCopy,
  Power,
  PowerOff,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { browserOpsApi, getApiErrorMessage } from '@/services/api'
import { cn } from '@/lib/utils'

interface CDPConnectProps {
  sessionId: string
}

interface CDPUrls {
  local_url: string
  devtools_frontend: string
  ws_debug_url: string
  json_url: string
}

export function CDPConnect({ sessionId }: CDPConnectProps) {
  const { toast } = useToast()

  const [remotePort, setRemotePort] = useState(9222)
  const [localPort, setLocalPort] = useState(9222)
  const [cdpActive, setCdpActive] = useState(false)
  const [tunnelId, setTunnelId] = useState<number | null>(null)
  const [cdpUrls, setCdpUrls] = useState<CDPUrls | null>(null)

  const startMutation = useMutation({
    mutationFn: () =>
      browserOpsApi.startCDP({
        session_id: sessionId,
        remote_port: remotePort,
        local_port: localPort,
      }),
    onSuccess: (data) => {
      setCdpActive(true)
      setTunnelId(data.tunnel_id)
      setCdpUrls({
        local_url: data.local_url ?? '',
        devtools_frontend: data.devtools_frontend ?? '',
        ws_debug_url: data.ws_debug_url ?? '',
        json_url: data.json_url ?? '',
      })
      toast({
        title: 'CDP tunnel started',
        description: `Remote :${remotePort} forwarded to local :${localPort}`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start CDP tunnel',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => {
      if (tunnelId === null) throw new Error('No active tunnel')
      return browserOpsApi.stopCDP({ session_id: sessionId, tunnel_id: tunnelId })
    },
    onSuccess: () => {
      setCdpActive(false)
      setTunnelId(null)
      setCdpUrls(null)
      toast({ title: 'CDP tunnel stopped' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop CDP tunnel',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const isPending = startMutation.isPending || stopMutation.isPending

  const handleToggle = () => {
    if (cdpActive) {
      stopMutation.mutate()
    } else {
      startMutation.mutate()
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} copied to clipboard` })
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy to clipboard' })
    }
  }

  const urlBlocks: { label: string; content: string }[] = cdpUrls
    ? [
        { label: 'DevTools URL', content: cdpUrls.devtools_frontend },
        { label: 'JSON Endpoint', content: cdpUrls.json_url },
        { label: 'WebSocket URL', content: cdpUrls.ws_debug_url },
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Monitor className="h-5 w-5" />
          CDP Remote Debugging
        </CardTitle>
        <CardDescription>
          Forward Chrome DevTools Protocol from the target to your local machine.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Warning alert */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Target Chrome must be running with{' '}
            <code className="rounded bg-yellow-500/20 px-1 py-0.5 font-mono text-xs">
              --remote-debugging-port=9222
            </code>
          </span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-full',
              cdpActive ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
          {cdpActive ? (
            <span className="font-medium text-green-600 dark:text-green-400">
              Active &mdash; remote :{remotePort} to local :{localPort}
            </span>
          ) : (
            <span className="text-muted-foreground">Inactive</span>
          )}
        </div>

        {/* Port inputs + toggle */}
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="cdp-remote-port"
              className="text-sm font-medium leading-none"
            >
              Remote Port
            </label>
            <Input
              id="cdp-remote-port"
              type="number"
              min={1}
              max={65535}
              value={remotePort}
              onChange={(e) => setRemotePort(Number(e.target.value))}
              disabled={cdpActive || isPending}
              className="w-32"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cdp-local-port"
              className="text-sm font-medium leading-none"
            >
              Local Port
            </label>
            <Input
              id="cdp-local-port"
              type="number"
              min={1024}
              max={65535}
              value={localPort}
              onChange={(e) => setLocalPort(Number(e.target.value))}
              disabled={cdpActive || isPending}
              className="w-32"
            />
          </div>

          <Button
            onClick={handleToggle}
            disabled={isPending}
            className={cn(cdpActive && 'bg-green-600 hover:bg-green-700')}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : cdpActive ? (
              <PowerOff className="mr-2 h-4 w-4" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            {isPending
              ? cdpActive
                ? 'Stopping...'
                : 'Starting...'
              : cdpActive
                ? 'Stop CDP'
                : 'Start CDP'}
          </Button>
        </div>

        {/* Connection URL blocks */}
        {cdpActive && cdpUrls && (
          <div className="space-y-3 pt-2">
            {urlBlocks.map((block) => (
              <div key={block.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{block.label}</span>
                </div>
                <div className="relative">
                  <pre className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all pr-10">
                    {block.content}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => copyToClipboard(block.content, block.label)}
                    title={`Copy ${block.label}`}
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CDPConnect
