import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { beaconsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Radio,
  RefreshCw,
  Trash2,
  Clock,
  Info,
  ListTodo,
  Loader2,
  Globe,
  User,
  HardDrive,
  Monitor,
  Cpu,
  StickyNote,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BeaconTaskQueue } from '@/components/beacon/BeaconTaskQueue'
import { SessionNotes } from '@/components/session/SessionNotes'
import { CommandHistory } from '@/components/session/CommandHistory'
import { NoBeaconsEmpty } from '@/components/common/EmptyState'
import { ListSkeleton } from '@/components/common/LoadingSkeleton'

type TabType = 'info' | 'tasks' | 'notes'

export function Beacons() {
  const [selectedBeacon, setSelectedBeacon] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['beacons'],
    queryFn: beaconsApi.list,
    refetchInterval: 10000,
  })

  const killMutation = useMutation({
    mutationFn: (id: string) => beaconsApi.kill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beacons'] })
      setSelectedBeacon(null)
      toast({ title: 'Beacon killed' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to kill beacon',
        description: error.response?.data?.detail,
      })
    },
  })

  const beacons = data?.beacons || []

  const tabs = [
    { id: 'info' as const, label: 'Info', icon: Info },
    { id: 'tasks' as const, label: 'Task Queue', icon: ListTodo },
    { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  ]

  const getOSIcon = (os: string) => {
    const osLower = os?.toLowerCase() || ''
    if (osLower.includes('windows')) return '🪟'
    if (osLower.includes('linux')) return '🐧'
    if (osLower.includes('darwin') || osLower.includes('macos')) return '🍎'
    return '💻'
  }

  // Calculate time since last check-in
  const getCheckInStatus = (lastCheckin: string | null, interval: number) => {
    if (!lastCheckin) return { status: 'pending', color: 'bg-yellow-500' }

    const lastTime = new Date(lastCheckin).getTime()
    const now = Date.now()
    const diff = (now - lastTime) / 1000 // seconds

    if (diff < interval * 1.5) {
      return { status: 'active', color: 'bg-green-500' }
    } else if (diff < interval * 3) {
      return { status: 'delayed', color: 'bg-yellow-500' }
    } else {
      return { status: 'missed', color: 'bg-red-500' }
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Beacons</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Beacon List */}
        <div className="w-80 flex-shrink-0 flex flex-col border rounded-lg bg-card">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              <span className="font-medium">Active Beacons</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {beacons.length}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4">
                <ListSkeleton items={3} />
              </div>
            ) : beacons.length === 0 ? (
              <div className="p-4">
                <NoBeaconsEmpty />
              </div>
            ) : (
              <div className="divide-y">
                {beacons.map((beacon: any) => {
                  const checkIn = getCheckInStatus(beacon.last_checkin, beacon.interval)

                  return (
                    <button
                      key={beacon.id}
                      onClick={() => {
                        setSelectedBeacon(beacon)
                        setActiveTab('info')
                      }}
                      className={cn(
                        'w-full text-left p-3 transition-colors hover:bg-muted/50',
                        selectedBeacon?.id === beacon.id && 'bg-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getOSIcon(beacon.os)}</span>
                        <span className="font-medium truncate flex-1">
                          {beacon.name}
                        </span>
                        <div className={cn('h-2 w-2 rounded-full', checkIn.color)} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {beacon.username}@{beacon.hostname}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {beacon.interval}s interval • {beacon.jitter}% jitter
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last: {beacon.last_checkin
                          ? formatRelativeTime(beacon.last_checkin)
                          : 'Pending first check-in'}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Beacon Details Panel */}
        <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-card overflow-hidden">
          {selectedBeacon ? (
            <>
              {/* Beacon Header */}
              <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
                <div className="text-3xl">{getOSIcon(selectedBeacon.os)}</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate">
                    {selectedBeacon.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedBeacon.username}@{selectedBeacon.hostname}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Next check-in: ~{selectedBeacon.interval}s
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => killMutation.mutate(selectedBeacon.id)}
                  disabled={killMutation.isPending}
                >
                  {killMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Kill Beacon
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
                        value={selectedBeacon.username}
                      />
                      <InfoCard
                        icon={HardDrive}
                        label="Hostname"
                        value={selectedBeacon.hostname}
                      />
                      <InfoCard
                        icon={Globe}
                        label="Remote Address"
                        value={selectedBeacon.remote_address || 'N/A'}
                      />
                      <InfoCard
                        icon={Monitor}
                        label="Operating System"
                        value={`${selectedBeacon.os} (${selectedBeacon.arch})`}
                      />
                      <InfoCard
                        icon={Info}
                        label="Transport"
                        value={selectedBeacon.transport || 'N/A'}
                      />
                      <InfoCard
                        icon={Cpu}
                        label="Process ID"
                        value={selectedBeacon.pid?.toString() || 'N/A'}
                      />
                      <InfoCard
                        icon={Clock}
                        label="Check-in Interval"
                        value={`${selectedBeacon.interval}s (+${selectedBeacon.jitter}% jitter)`}
                      />
                      <InfoCard
                        icon={Clock}
                        label="Last Check-in"
                        value={selectedBeacon.last_checkin
                          ? formatRelativeTime(selectedBeacon.last_checkin)
                          : 'Pending'}
                      />
                      <InfoCard
                        icon={Clock}
                        label="Next Check-in"
                        value={selectedBeacon.next_checkin
                          ? formatRelativeTime(selectedBeacon.next_checkin)
                          : `~${selectedBeacon.interval}s`}
                      />
                    </div>

                    {/* Beacon ID */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Beacon ID</p>
                      <p className="font-mono text-sm break-all">{selectedBeacon.id}</p>
                    </div>

                    {/* Info about beacons */}
                    <div className="mt-6 p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
                      <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">
                        About Beacons
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Beacons are asynchronous implants that check in at specified intervals.
                        Unlike interactive sessions, beacons queue tasks and execute them on
                        the next check-in. Use the Task Queue tab to queue commands.
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-6">
                      <h3 className="font-medium mb-3">Quick Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTab('tasks')}
                        >
                          <ListTodo className="h-4 w-4 mr-1" />
                          View Task Queue
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <BeaconTaskQueue
                    beaconId={selectedBeacon.id}
                    beaconName={selectedBeacon.name}
                  />
                )}

                {activeTab === 'notes' && (
                  <div className="p-6 overflow-auto h-full space-y-6">
                    <SessionNotes
                      sessionId={selectedBeacon.id}
                      sessionType="beacon"
                    />
                    <CommandHistory
                      sessionId={selectedBeacon.id}
                      sessionType="beacon"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Radio className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium">No Beacon Selected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a beacon from the list to view details and queue tasks
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
