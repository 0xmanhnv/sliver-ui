import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Play,
  Square,
  Loader2,
  Camera,
  Cookie,
  Globe,
  Terminal,
  ArrowRight,
  ImageOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { browserOpsApi, getApiErrorMessage } from '@/services/api'
import { cn } from '@/lib/utils'

interface AutomationPanelProps {
  selectedCookieIds: number[]
  sessionId?: string
}

interface JsHistoryEntry {
  type: 'input' | 'output' | 'error'
  text: string
}

export function AutomationPanel({ selectedCookieIds, sessionId: _sessionId }: AutomationPanelProps) {
  const { toast } = useToast()
  const jsHistoryRef = useRef<HTMLDivElement>(null)

  const [automationId, setAutomationId] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [jsInput, setJsInput] = useState('')
  const [jsHistory, setJsHistory] = useState<JsHistoryEntry[]>([])
  const [initialUrl, setInitialUrl] = useState('')
  const [proxyInput, setProxyInput] = useState('')
  const [fullPage, setFullPage] = useState(false)

  // Auto-scroll JS history to bottom when new entries are added
  useEffect(() => {
    if (jsHistoryRef.current) {
      jsHistoryRef.current.scrollTop = jsHistoryRef.current.scrollHeight
    }
  }, [jsHistory])

  const startMutation = useMutation({
    mutationFn: () =>
      browserOpsApi.startAutomation({
        cookie_ids: selectedCookieIds,
        url: initialUrl || undefined,
        proxy: proxyInput || undefined,
      }),
    onSuccess: (data) => {
      setAutomationId(data.automation_id)
      if (data.screenshot) {
        setScreenshot(data.screenshot)
      }
      if (data.page_title) {
        setPageTitle(data.page_title)
      }
      if (data.page_url) {
        setCurrentUrl(data.page_url)
      }
      toast({
        title: 'Automation started',
        description: `Session ${data.automation_id} is active`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to start automation',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const navigateMutation = useMutation({
    mutationFn: (url: string) => {
      if (!automationId) throw new Error('No active automation')
      return browserOpsApi.automationNavigate({
        automation_id: automationId,
        url,
        screenshot: true,
      })
    },
    onSuccess: (data) => {
      if (data.title) {
        setPageTitle(data.title)
      }
      if (data.url) {
        setCurrentUrl(data.url)
      }
      if (data.screenshot) {
        setScreenshot(data.screenshot)
      }
      toast({
        title: 'Navigation complete',
        description: data.title || data.url || 'Page loaded',
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Navigation failed',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const screenshotMutation = useMutation({
    mutationFn: () => {
      if (!automationId) throw new Error('No active automation')
      return browserOpsApi.automationScreenshot({
        automation_id: automationId,
        full_page: fullPage,
      })
    },
    onSuccess: (data) => {
      if (data.screenshot) {
        setScreenshot(data.screenshot)
      }
      toast({
        title: 'Screenshot captured',
        description: `${data.width}x${data.height}`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Screenshot failed',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const executeJsMutation = useMutation({
    mutationFn: (script: string) => {
      if (!automationId) throw new Error('No active automation')
      return browserOpsApi.automationExecuteJS({
        automation_id: automationId,
        script,
      })
    },
    onSuccess: (data, script) => {
      setJsHistory((prev) => [
        ...prev,
        { type: 'input', text: script },
      ])
      if (data.error) {
        setJsHistory((prev) => [
          ...prev,
          { type: 'error', text: data.error },
        ])
      } else {
        const resultText =
          data.result !== undefined && data.result !== null
            ? typeof data.result === 'string'
              ? data.result
              : JSON.stringify(data.result, null, 2)
            : 'undefined'
        setJsHistory((prev) => [
          ...prev,
          { type: 'output', text: resultText },
        ])
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any, script) => {
      setJsHistory((prev) => [
        ...prev,
        { type: 'input', text: script },
        {
          type: 'error',
          text: getApiErrorMessage(error),
        },
      ])
    },
  })

  const cookiesMutation = useMutation({
    mutationFn: () => {
      if (!automationId) throw new Error('No active automation')
      return browserOpsApi.automationCookies(automationId)
    },
    onSuccess: (data) => {
      toast({
        title: 'Cookies retrieved',
        description: `${data.count} cookie${data.count === 1 ? '' : 's'} found in automation context`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to get cookies',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => {
      if (!automationId) throw new Error('No active automation')
      return browserOpsApi.stopAutomation(automationId)
    },
    onSuccess: (data) => {
      setAutomationId(null)
      setScreenshot(null)
      setPageTitle('')
      setCurrentUrl('')
      setJsInput('')
      setJsHistory([])
      toast({
        title: 'Automation stopped',
        description: data.message || 'Session terminated',
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to stop automation',
        description:
          getApiErrorMessage(error),
      })
    },
  })

  const isActive = automationId !== null

  const handleNavigate = () => {
    if (!currentUrl.trim()) return
    navigateMutation.mutate(currentUrl.trim())
  }

  const handleNavigateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleExecuteJs = () => {
    if (!jsInput.trim()) return
    const script = jsInput.trim()
    setJsInput('')
    executeJsMutation.mutate(script)
  }

  const handleJsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecuteJs()
    }
  }

  const handleStop = () => {
    stopMutation.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="h-5 w-5" />
            Session Replay
          </CardTitle>
          {isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Stop
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Start section / Status indicator */}
        {!isActive ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
              <span className="text-muted-foreground">Inactive</span>
              <Badge variant="secondary" className="ml-2">
                {selectedCookieIds.length} cookies selected
              </Badge>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="automation-initial-url"
                className="text-sm font-medium leading-none"
              >
                Initial URL
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="automation-initial-url"
                type="text"
                placeholder="https://example.com"
                value={initialUrl}
                onChange={(e) => setInitialUrl(e.target.value)}
                disabled={startMutation.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="automation-proxy"
                className="text-sm font-medium leading-none"
              >
                Proxy
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="automation-proxy"
                type="text"
                placeholder="socks5://127.0.0.1:1080"
                value={proxyInput}
                onChange={(e) => setProxyInput(e.target.value)}
                disabled={startMutation.isPending}
              />
            </div>

            <Button
              onClick={() => startMutation.mutate()}
              disabled={selectedCookieIds.length === 0 || startMutation.isPending}
              className="w-full sm:w-auto"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Automation
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="font-medium text-green-600 dark:text-green-400">
              Active ({automationId})
            </span>
          </div>
        )}

        {/* URL Bar */}
        {isActive && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="https://example.com"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyDown={handleNavigateKeyDown}
                disabled={navigateMutation.isPending}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleNavigate}
              disabled={!currentUrl.trim() || navigateMutation.isPending}
            >
              {navigateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Go
            </Button>
          </div>
        )}

        {/* Page title */}
        {isActive && pageTitle && (
          <p className="text-sm text-muted-foreground truncate">
            {pageTitle}
          </p>
        )}

        {/* Screenshot Display */}
        {isActive && (
          <div className="rounded-md border max-h-96 overflow-auto bg-muted/20">
            {screenshot ? (
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt={pageTitle || 'Browser screenshot'}
                className="w-full h-auto"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ImageOff className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No screenshot</p>
                <p className="text-xs mt-1">Navigate to a page or take a screenshot</p>
              </div>
            )}
          </div>
        )}

        {/* Full Page Screenshot toggle */}
        {isActive && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={fullPage}
              onChange={(e) => setFullPage(e.target.checked)}
              className="rounded border-gray-300"
            />
            Full Page Screenshot
          </label>
        )}

        {/* JS Console */}
        {isActive && (
          <div className="rounded-md border">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">JS Console</span>
            </div>

            {/* History area */}
            <div
              ref={jsHistoryRef}
              className="max-h-64 overflow-auto p-3 font-mono text-xs space-y-1"
            >
              {jsHistory.length === 0 ? (
                <p className="text-muted-foreground">
                  Enter JavaScript to execute in the browser context.
                </p>
              ) : (
                jsHistory.map((entry, i) => (
                  <div
                    key={i}
                    className={cn(
                      'whitespace-pre-wrap break-all',
                      entry.type === 'input' && 'text-foreground',
                      entry.type === 'output' && 'text-green-500',
                      entry.type === 'error' && 'text-red-500'
                    )}
                  >
                    <span className="select-none opacity-50 mr-1">
                      {entry.type === 'input' ? '>' : entry.type === 'output' ? '<' : '!'}
                    </span>
                    {entry.text}
                  </div>
                ))
              )}
            </div>

            {/* Input row */}
            <div className="flex gap-2 p-2 border-t">
              <Input
                type="text"
                placeholder="document.title"
                value={jsInput}
                onChange={(e) => setJsInput(e.target.value)}
                onKeyDown={handleJsKeyDown}
                disabled={executeJsMutation.isPending}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={handleExecuteJs}
                disabled={!jsInput.trim() || executeJsMutation.isPending}
              >
                {executeJsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Execute
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons row */}
        {isActive && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => screenshotMutation.mutate()}
              disabled={screenshotMutation.isPending}
            >
              {screenshotMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Screenshot
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => cookiesMutation.mutate()}
              disabled={cookiesMutation.isPending}
            >
              {cookiesMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cookie className="mr-2 h-4 w-4" />
              )}
              Get Cookies
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Stop
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AutomationPanel
