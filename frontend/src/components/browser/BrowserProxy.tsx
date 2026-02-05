import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Globe, Loader2, ClipboardCopy, Power, PowerOff } from 'lucide-react'
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

interface BrowserProxyProps {
  sessionId: string
}

interface ProxyConfig {
  proxy_pac: string
  browser_launch_cmd: string
  foxyproxy_config: string
  curl_example: string
}

export function BrowserProxy({ sessionId }: BrowserProxyProps) {
  const { toast } = useToast()

  const [port, setPort] = useState(1080)
  const [proxyActive, setProxyActive] = useState(false)
  const [tunnelId, setTunnelId] = useState<number | null>(null)
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig | null>(null)

  const startMutation = useMutation({
    mutationFn: () => browserOpsApi.startProxy({ session_id: sessionId, port }),
    onSuccess: (data) => {
      setProxyActive(true)
      setTunnelId(data.tunnel_id)
      setProxyConfig({
        proxy_pac: data.proxy_pac ?? '',
        browser_launch_cmd: data.browser_launch_cmd ?? '',
        foxyproxy_config: data.foxyproxy_config ?? '',
        curl_example: data.curl_example ?? '',
      })
      toast({
        title: 'SOCKS5 proxy started',
        description: `Listening on port ${port}`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start proxy',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => {
      if (tunnelId === null) throw new Error('No active tunnel')
      return browserOpsApi.stopProxy({ session_id: sessionId, tunnel_id: tunnelId })
    },
    onSuccess: () => {
      setProxyActive(false)
      setTunnelId(null)
      setProxyConfig(null)
      toast({ title: 'SOCKS5 proxy stopped' })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop proxy',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const isPending = startMutation.isPending || stopMutation.isPending

  const handleToggle = () => {
    if (proxyActive) {
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

  const configBlocks: { label: string; content: string }[] = proxyConfig
    ? [
        { label: 'Chrome Launch', content: proxyConfig.browser_launch_cmd },
        { label: 'curl Example', content: proxyConfig.curl_example },
        { label: 'FoxyProxy', content: proxyConfig.foxyproxy_config },
        { label: 'PAC File', content: proxyConfig.proxy_pac },
      ]
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5" />
          SOCKS5 Browser Proxy
        </CardTitle>
        <CardDescription>
          Route browser traffic through the implant session via a local SOCKS5
          proxy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-full',
              proxyActive ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
          {proxyActive ? (
            <span className="font-medium text-green-600 dark:text-green-400">
              Active on port {port}
            </span>
          ) : (
            <span className="text-muted-foreground">Inactive</span>
          )}
        </div>

        {/* Port input + toggle */}
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="proxy-port" className="text-sm font-medium leading-none">
              Port
            </label>
            <Input
              id="proxy-port"
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              disabled={proxyActive || isPending}
              className="w-32"
            />
          </div>

          <Button
            onClick={handleToggle}
            disabled={isPending}
            variant={proxyActive ? 'default' : 'default'}
            className={cn(proxyActive && 'bg-green-600 hover:bg-green-700')}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : proxyActive ? (
              <PowerOff className="mr-2 h-4 w-4" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            {isPending
              ? proxyActive
                ? 'Stopping...'
                : 'Starting...'
              : proxyActive
                ? 'Stop Proxy'
                : 'Start Proxy'}
          </Button>
        </div>

        {/* Configuration snippets */}
        {proxyActive && proxyConfig && (
          <div className="space-y-3 pt-2">
            {configBlocks.map((block) => (
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

export default BrowserProxy
