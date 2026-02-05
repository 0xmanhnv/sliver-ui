import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Syringe,
  Loader2,
  ClipboardCopy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MonitorSmartphone,
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

interface CookieInjectorProps {
  selectedCookieIds: number[]
  sessionId?: string
}

interface CDPTab {
  id: string
  title: string
  url: string
  type: string
  webSocketDebuggerUrl?: string
}

interface InjectionResult {
  injected_count: number
  failed_count: number
  errors: string[]
}

const CHROME_LAUNCH_CMD =
  'google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/cdp-profile'

export function CookieInjector({ selectedCookieIds, sessionId: _sessionId }: CookieInjectorProps) {
  const { toast } = useToast()

  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(9222)
  const [navigateUrl, setNavigateUrl] = useState('')
  const [tabs, setTabs] = useState<CDPTab[]>([])
  const [injectionResult, setInjectionResult] = useState<InjectionResult | null>(null)

  // List open CDP tabs
  const listTabsMutation = useMutation({
    mutationFn: () => browserOpsApi.getCDPTargets(host, port),
    onSuccess: (data) => {
      const targets = data?.targets ?? data ?? []
      setTabs(Array.isArray(targets) ? targets : [])
      toast({
        title: 'CDP targets retrieved',
        description: `Found ${Array.isArray(targets) ? targets.length : 0} open tab${Array.isArray(targets) && targets.length === 1 ? '' : 's'}`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      setTabs([])
      toast({
        variant: 'destructive',
        title: 'Failed to list CDP targets',
        description:
          getApiErrorMessage(error, 'Could not connect to Chrome DevTools. Is Chrome running with --remote-debugging-port?'),
      })
    },
  })

  // Inject cookies via CDP
  const injectMutation = useMutation({
    mutationFn: () =>
      browserOpsApi.injectCookies({
        host,
        port,
        cookie_ids: selectedCookieIds,
        url: navigateUrl || undefined,
      }),
    onSuccess: (data) => {
      const result: InjectionResult = {
        injected_count: data?.injected_count ?? 0,
        failed_count: data?.failed_count ?? 0,
        errors: data?.errors ?? [],
      }
      setInjectionResult(result)
      toast({
        title: 'Cookie injection complete',
        description: `${result.injected_count} injected, ${result.failed_count} failed`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      setInjectionResult(null)
      toast({
        variant: 'destructive',
        title: 'Cookie injection failed',
        description:
          getApiErrorMessage(error, 'Unknown error during injection'),
      })
    },
  })

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} copied to clipboard` })
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy to clipboard' })
    }
  }

  const isPending = listTabsMutation.isPending || injectMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Syringe className="h-5 w-5" />
          CDP Cookie Injection
        </CardTitle>
        <CardDescription>
          Inject extracted cookies into a Chrome instance via the Chrome DevTools Protocol.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Instructions / warning banner */}
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-1">
            <span>
              Launch Chrome with remote debugging enabled first:
            </span>
            <div className="relative">
              <pre className="rounded bg-yellow-500/20 px-2 py-1.5 font-mono text-xs break-all whitespace-pre-wrap pr-8">
                {CHROME_LAUNCH_CMD}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-0.5 h-6 w-6"
                onClick={() => copyToClipboard(CHROME_LAUNCH_CMD, 'Chrome launch command')}
                title="Copy launch command"
              >
                <ClipboardCopy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* CDP Target section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">CDP Target</h3>

          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="cdp-inject-host" className="text-sm font-medium leading-none">
                Host
              </label>
              <Input
                id="cdp-inject-host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={isPending}
                placeholder="127.0.0.1"
                className="w-40"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cdp-inject-port" className="text-sm font-medium leading-none">
                Port
              </label>
              <Input
                id="cdp-inject-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={isPending}
                className="w-28"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => listTabsMutation.mutate()}
              disabled={isPending}
            >
              {listTabsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MonitorSmartphone className="mr-2 h-4 w-4" />
              )}
              List Tabs
            </Button>
          </div>

          {/* Display open tabs */}
          {tabs.length > 0 && (
            <div className="rounded-md border">
              <div className="px-3 py-2 border-b bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">
                  Open Tabs ({tabs.length})
                </span>
              </div>
              <ul className="divide-y max-h-48 overflow-auto">
                {tabs.map((tab, idx) => (
                  <li
                    key={tab.id ?? idx}
                    className="px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <p className="font-medium truncate">
                      {tab.title || '(untitled)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {tab.url}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Injection section */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium">Injection</h3>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Selected cookies:</span>
            <span
              className={cn(
                'font-medium',
                selectedCookieIds.length > 0
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {selectedCookieIds.length}
            </span>
            {selectedCookieIds.length === 0 && (
              <span className="text-xs text-muted-foreground">
                (select cookies from the table above)
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cdp-navigate-url" className="text-sm font-medium leading-none">
              Navigate to URL after injection
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="cdp-navigate-url"
              type="text"
              value={navigateUrl}
              onChange={(e) => setNavigateUrl(e.target.value)}
              disabled={isPending}
              placeholder="https://example.com/dashboard"
              className="max-w-md"
            />
          </div>

          <Button
            onClick={() => {
              setInjectionResult(null)
              injectMutation.mutate()
            }}
            disabled={selectedCookieIds.length === 0 || injectMutation.isPending}
          >
            {injectMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Syringe className="mr-2 h-4 w-4" />
            )}
            {injectMutation.isPending
              ? 'Injecting...'
              : `Inject ${selectedCookieIds.length} Cookie${selectedCookieIds.length === 1 ? '' : 's'}`}
          </Button>
        </div>

        {/* Injection results */}
        {injectionResult && (
          <div className="space-y-2 border-t pt-4">
            {injectionResult.injected_count > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Injected {injectionResult.injected_count} cookie
                  {injectionResult.injected_count === 1 ? '' : 's'} successfully
                </span>
              </div>
            )}

            {injectionResult.failed_count > 0 && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Failed to inject {injectionResult.failed_count} cookie
                    {injectionResult.failed_count === 1 ? '' : 's'}
                  </span>
                </div>
                {injectionResult.errors.length > 0 && (
                  <ul className="mt-2 ml-6 list-disc space-y-1 text-xs">
                    {injectionResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CookieInjector
