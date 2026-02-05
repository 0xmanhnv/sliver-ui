import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Monitor,
  RefreshCw,
  Terminal as TerminalIcon,
  Trash2,
  Camera,
  FolderOpen,
  Cpu,
  Info,
  Loader2,
  ChevronRight,
  Globe,
  User,
  HardDrive,
  Clock,
  StickyNote,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Terminal } from '@/components/terminal/Terminal'
import { FileBrowser } from '@/components/files/FileBrowser'
import { ProcessList } from '@/components/process/ProcessList'
import { ScreenshotViewer } from '@/components/screenshot/ScreenshotViewer'
import { PivotManager } from '@/components/pivots/PivotManager'
import { SessionNotes } from '@/components/session/SessionNotes'
import { CommandHistory } from '@/components/session/CommandHistory'
import { NoSessionsEmpty } from '@/components/common/EmptyState'
import { ListSkeleton } from '@/components/common/LoadingSkeleton'
import { Network } from 'lucide-react'

type TabType = 'info' | 'terminal' | 'files' | 'processes' | 'screenshots' | 'pivots' | 'notes'

export function Sessions() {
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    refetchInterval: 10000,
  })

  const killMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.kill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setSelectedSession(null)
      toast({ title: 'Session killed' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to kill session',
        description: error.response?.data?.detail,
      })
    },
  })

  const sessions = data?.sessions || []

  const tabs = [
    { id: 'info' as const, label: 'Info', icon: Info },
    { id: 'terminal' as const, label: 'Terminal', icon: TerminalIcon },
    { id: 'files' as const, label: 'Files', icon: FolderOpen },
    { id: 'processes' as const, label: 'Processes', icon: Cpu },
    { id: 'screenshots' as const, label: 'Screenshots', icon: Camera },
    { id: 'pivots' as const, label: 'Pivots', icon: Network },
    { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  ]

  const getOSIcon = (os: string) => {
    const osLower = os?.toLowerCase() || ''
    if (osLower.includes('windows')) return '🪟'
    if (osLower.includes('linux')) return '🐧'
    if (osLower.includes('darwin') || osLower.includes('macos')) return '🍎'
    return '💻'
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Sessions</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Session List */}
        <div className="w-80 flex-shrink-0 flex flex-col border rounded-lg bg-card">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="font-medium">Active Sessions</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {sessions.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4">
                <ListSkeleton items={3} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4">
                <NoSessionsEmpty />
              </div>
            ) : (
              <div className="divide-y">
                {sessions.map((session: any) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session)
                      setActiveTab('info')
                    }}
                    className={cn(
                      'w-full text-left p-3 transition-colors hover:bg-muted/50',
                      selectedSession?.id === session.id && 'bg-primary/10'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getOSIcon(session.os)}</span>
                      <span className="font-medium truncate flex-1">
                        {session.name}
                      </span>
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {session.username}@{session.hostname}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{session.os}/{session.arch}</span>
                      <span>•</span>
                      <span>{session.transport}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Session Details Panel */}
        <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-card overflow-hidden">
          {selectedSession ? (
            <>
              {/* Session Header */}
              <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
                <div className="text-3xl">{getOSIcon(selectedSession.os)}</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate">
                    {selectedSession.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedSession.username}@{selectedSession.hostname}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => killMutation.mutate(selectedSession.id)}
                  disabled={killMutation.isPending}
                >
                  {killMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Kill Session
                </Button>
              </div>

              {/* Tabs */}
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

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'info' && (
                  <div className="p-6 overflow-auto h-full">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <InfoCard
                        icon={User}
                        label="Username"
                        value={selectedSession.username}
                      />
                      <InfoCard
                        icon={HardDrive}
                        label="Hostname"
                        value={selectedSession.hostname}
                      />
                      <InfoCard
                        icon={Globe}
                        label="Remote Address"
                        value={selectedSession.remote_address}
                      />
                      <InfoCard
                        icon={Monitor}
                        label="Operating System"
                        value={`${selectedSession.os} (${selectedSession.arch})`}
                      />
                      <InfoCard
                        icon={Info}
                        label="Transport"
                        value={selectedSession.transport}
                      />
                      <InfoCard
                        icon={Cpu}
                        label="Process ID"
                        value={selectedSession.pid?.toString() || 'N/A'}
                      />
                      <InfoCard
                        icon={Clock}
                        label="Connected"
                        value={selectedSession.first_contact
                          ? formatRelativeTime(selectedSession.first_contact)
                          : 'Unknown'}
                      />
                      <InfoCard
                        icon={Clock}
                        label="Last Seen"
                        value={selectedSession.last_checkin
                          ? formatRelativeTime(selectedSession.last_checkin)
                          : 'Unknown'}
                      />
                    </div>

                    {/* Session ID */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Session ID</p>
                      <p className="font-mono text-sm break-all">{selectedSession.id}</p>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-6">
                      <h3 className="font-medium mb-3">Quick Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTab('terminal')}
                        >
                          <TerminalIcon className="h-4 w-4 mr-1" />
                          Open Terminal
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTab('files')}
                        >
                          <FolderOpen className="h-4 w-4 mr-1" />
                          Browse Files
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTab('processes')}
                        >
                          <Cpu className="h-4 w-4 mr-1" />
                          View Processes
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTab('screenshots')}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Capture Screenshot
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'terminal' && (
                  <Terminal
                    sessionId={selectedSession.id}
                    sessionName={selectedSession.name}
                    os={selectedSession.os}
                  />
                )}

                {activeTab === 'files' && (
                  <FileBrowser
                    sessionId={selectedSession.id}
                    initialPath={selectedSession.os?.toLowerCase() === 'windows' ? 'C:\\' : '/'}
                  />
                )}

                {activeTab === 'processes' && (
                  <ProcessList
                    sessionId={selectedSession.id}
                    sessionPid={selectedSession.pid}
                  />
                )}

                {activeTab === 'screenshots' && (
                  <ScreenshotViewer
                    sessionId={selectedSession.id}
                    sessionName={selectedSession.name}
                  />
                )}

                {activeTab === 'pivots' && (
                  <PivotManager
                    sessionId={selectedSession.id}
                    sessionName={selectedSession.name}
                  />
                )}

                {activeTab === 'notes' && (
                  <div className="p-6 overflow-auto h-full space-y-6">
                    <SessionNotes
                      sessionId={selectedSession.id}
                      sessionType="session"
                    />
                    <CommandHistory
                      sessionId={selectedSession.id}
                      sessionType="session"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Monitor className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium">No Session Selected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a session from the list to interact with it
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="p-4 border rounded-lg bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="font-medium truncate" title={value}>
        {value}
      </p>
    </div>
  )
}
