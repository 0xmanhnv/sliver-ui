import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cleanupApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  Monitor,
  Radio,
  Antenna,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Skull,
  HelpCircle,
  Info,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface StaleSession {
  id: string
  name: string
  hostname: string
  username: string
  os: string
  stale_minutes: number
}

interface DeadBeacon {
  id: string
  name: string
  hostname: string
  username: string
  os: string
  missed_checkins: number
}

interface CleanupStatus {
  stale_sessions: StaleSession[]
  dead_beacons: DeadBeacon[]
  total_sessions: number
  total_beacons: number
  total_jobs: number
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
}

export function Cleanup() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [selectedBeacons, setSelectedBeacons] = useState<string[]>([])
  const [confirmKillAll, setConfirmKillAll] = useState<'sessions' | 'beacons' | 'everything' | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cleanup-status'],
    queryFn: () => cleanupApi.getStatus(),
    refetchInterval: 30000,
  })

  const status: CleanupStatus = data || {
    stale_sessions: [],
    dead_beacons: [],
    total_sessions: 0,
    total_beacons: 0,
    total_jobs: 0,
  }

  // Mutations
  const bulkKillSessionsMutation = useMutation({
    mutationFn: (ids: string[]) => cleanupApi.bulkKillSessions(ids),
    onSuccess: (result) => {
      toast({
        title: 'Sessions Removed',
        description: `Removed ${result.success.length} sessions. ${result.failed.length} failed.`,
      })
      setSelectedSessions([])
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Operation Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkKillBeaconsMutation = useMutation({
    mutationFn: (ids: string[]) => cleanupApi.bulkKillBeacons(ids),
    onSuccess: (result) => {
      toast({
        title: 'Beacons Removed',
        description: `Removed ${result.success.length} beacons. ${result.failed.length} failed.`,
      })
      setSelectedBeacons([])
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] })
      queryClient.invalidateQueries({ queryKey: ['beacons'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Operation Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const killAllSessionsMutation = useMutation({
    mutationFn: () => cleanupApi.killAllSessions(),
    onSuccess: (result) => {
      toast({
        title: 'All Sessions Removed',
        description: `Successfully removed ${result.success.length} sessions.`,
      })
      setConfirmKillAll(null)
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (error: Error) => {
      toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' })
    },
  })

  const killAllBeaconsMutation = useMutation({
    mutationFn: () => cleanupApi.killAllBeacons(),
    onSuccess: (result) => {
      toast({
        title: 'All Beacons Removed',
        description: `Successfully removed ${result.success.length} beacons.`,
      })
      setConfirmKillAll(null)
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] })
      queryClient.invalidateQueries({ queryKey: ['beacons'] })
    },
    onError: (error: Error) => {
      toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' })
    },
  })

  const killEverythingMutation = useMutation({
    mutationFn: () => cleanupApi.killEverything(),
    onSuccess: (result) => {
      toast({
        title: 'Cleanup Complete',
        description: `Sessions: ${result.sessions_killed}, Beacons: ${result.beacons_killed}, Listeners: ${result.jobs_killed} removed.`,
      })
      setConfirmKillAll(null)
      queryClient.invalidateQueries()
    },
    onError: (error: Error) => {
      toast({ title: 'Operation Failed', description: error.message, variant: 'destructive' })
    },
  })

  const toggleSession = (id: string) => {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const toggleBeacon = (id: string) => {
    setSelectedBeacons((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  const selectAllStaleSessions = () => {
    setSelectedSessions(status.stale_sessions.map((s) => s.id))
  }

  const selectAllDeadBeacons = () => {
    setSelectedBeacons(status.dead_beacons.map((b) => b.id))
  }

  const isLoading2 =
    bulkKillSessionsMutation.isPending ||
    bulkKillBeaconsMutation.isPending ||
    killAllSessionsMutation.isPending ||
    killAllBeaconsMutation.isPending ||
    killEverythingMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cleanup Manager</h1>
          <p className="text-muted-foreground">
            Manage inactive connections and clean up your infrastructure
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.total_sessions}</div>
            <p className="text-xs text-muted-foreground">Live connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Beacons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.total_beacons}</div>
            <p className="text-xs text-muted-foreground">Scheduled callbacks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Antenna className="h-4 w-4" />
              Listeners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.total_jobs}</div>
            <p className="text-xs text-muted-foreground">Waiting for connections</p>
          </CardContent>
        </Card>
        <Card className={status.stale_sessions.length > 0 ? "border-yellow-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-500" title="Sessions that haven't responded in 24+ hours">
              <Clock className="h-4 w-4" />
              Inactive
              <HelpCircle className="h-3 w-3 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {status.stale_sessions.length}
            </div>
            <p className="text-xs text-muted-foreground">No response &gt; 24h</p>
          </CardContent>
        </Card>
        <Card className={status.dead_beacons.length > 0 ? "border-red-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-500" title="Beacons that missed 10+ scheduled check-ins">
              <AlertTriangle className="h-4 w-4" />
              Unresponsive
              <HelpCircle className="h-3 w-3 opacity-50" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {status.dead_beacons.length}
            </div>
            <p className="text-xs text-muted-foreground">Missed &gt; 10 check-ins</p>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Skull className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Bulk cleanup operations. <span className="text-red-500 font-medium">These actions cannot be undone.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {confirmKillAll === 'sessions' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Remove all sessions?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => killAllSessionsMutation.mutate()}
                  disabled={isLoading2}
                >
                  {killAllSessionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmKillAll(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={() => setConfirmKillAll('sessions')}
                disabled={isLoading2 || status.total_sessions === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove All Sessions ({status.total_sessions})
              </Button>
            )}

            {confirmKillAll === 'beacons' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Remove all beacons?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => killAllBeaconsMutation.mutate()}
                  disabled={isLoading2}
                >
                  {killAllBeaconsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmKillAll(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                onClick={() => setConfirmKillAll('beacons')}
                disabled={isLoading2 || status.total_beacons === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove All Beacons ({status.total_beacons})
              </Button>
            )}
          </div>

          {/* Remove Everything - with typed confirmation */}
          <div className="pt-4 border-t border-red-500/20">
            {confirmKillAll === 'everything' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">This will remove ALL sessions, beacons, and listeners!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Type <code className="px-1 py-0.5 bg-red-500/10 rounded text-red-500">CONFIRM</code> to proceed:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type CONFIRM"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-40 border-red-500/50"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => {
                      killEverythingMutation.mutate()
                      setConfirmText('')
                    }}
                    disabled={isLoading2 || confirmText !== 'CONFIRM'}
                  >
                    {killEverythingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Skull className="h-4 w-4 mr-1" />
                    )}
                    Remove Everything
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmKillAll(null)
                      setConfirmText('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setConfirmKillAll('everything')}
                disabled={isLoading2}
              >
                <Skull className="h-4 w-4 mr-2" />
                Remove Everything
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stale Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Inactive Sessions
                </CardTitle>
                <CardDescription>Sessions with no response for 24+ hours</CardDescription>
              </div>
              <div className="flex gap-2">
                {status.stale_sessions.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={selectAllStaleSessions}>
                      Select All
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => bulkKillSessionsMutation.mutate(selectedSessions)}
                      disabled={selectedSessions.length === 0 || isLoading2}
                    >
                      {bulkKillSessionsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Remove ({selectedSessions.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {status.stale_sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                <p>No stale sessions</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {status.stale_sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedSessions.includes(session.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{session.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.username}@{session.hostname}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{session.os}</p>
                        <p className="text-xs text-yellow-500">
                          Stale: {formatMinutes(session.stale_minutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dead Beacons */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Unresponsive Beacons
                </CardTitle>
                <CardDescription>Beacons that missed 10+ scheduled check-ins</CardDescription>
              </div>
              <div className="flex gap-2">
                {status.dead_beacons.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={selectAllDeadBeacons}>
                      Select All
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => bulkKillBeaconsMutation.mutate(selectedBeacons)}
                      disabled={selectedBeacons.length === 0 || isLoading2}
                    >
                      {bulkKillBeaconsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Remove ({selectedBeacons.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {status.dead_beacons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                <p>No dead beacons</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {status.dead_beacons.map((beacon) => (
                  <div
                    key={beacon.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedBeacons.includes(beacon.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleBeacon(beacon.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{beacon.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {beacon.username}@{beacon.hostname}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{beacon.os}</p>
                        <p className="text-xs text-red-500">
                          Missed: {beacon.missed_checkins} check-ins
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cleanup Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Cleanup Checklist</CardTitle>
          <CardDescription>
            Recommended cleanup steps before ending an engagement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Target Cleanup</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Remove persistence mechanisms
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Delete dropped executables
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Delete credential dumps
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Clear event logs (if authorized)
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Sliver Cleanup</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  {status.dead_beacons.length === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Kill dead beacons
                </li>
                <li className="flex items-center gap-2">
                  {status.stale_sessions.length === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Kill stale sessions
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Export session notes
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Archive audit logs
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
