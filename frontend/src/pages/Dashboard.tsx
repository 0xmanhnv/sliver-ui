import { useQuery } from '@tanstack/react-query'
import { sessionsApi, beaconsApi, listenersApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Monitor, Radio, Antenna, Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    refetchInterval: 10000,
  })

  const {
    data: beaconsData,
    isLoading: beaconsLoading,
    refetch: refetchBeacons,
  } = useQuery({
    queryKey: ['beacons'],
    queryFn: beaconsApi.list,
    refetchInterval: 10000,
  })

  const {
    data: listenersData,
    isLoading: listenersLoading,
    refetch: refetchListeners,
  } = useQuery({
    queryKey: ['listeners'],
    queryFn: listenersApi.list,
    refetchInterval: 30000,
  })

  const sessions = sessionsData?.sessions || []
  const beacons = beaconsData?.beacons || []
  const listeners = listenersData?.listeners || []

  const handleRefresh = () => {
    refetchSessions()
    refetchBeacons()
    refetchListeners()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Sessions"
          value={sessionsLoading ? '...' : sessions.length}
          icon={Monitor}
          description="Interactive sessions"
        />
        <StatsCard
          title="Active Beacons"
          value={beaconsLoading ? '...' : beacons.length}
          icon={Radio}
          description="Beacon callbacks"
        />
        <StatsCard
          title="Listeners"
          value={listenersLoading ? '...' : listeners.length}
          icon={Antenna}
          description="Running listeners"
        />
        <StatsCard
          title="Total Implants"
          value={sessions.length + beacons.length}
          icon={Activity}
          description="All active implants"
        />
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground">No active sessions</p>
          ) : (
            <div className="space-y-4">
              {sessions.slice(0, 5).map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.username}@{session.hostname}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{session.os} / {session.arch}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.last_checkin
                        ? formatRelativeTime(session.last_checkin)
                        : 'Active'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Beacons */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Beacons</CardTitle>
        </CardHeader>
        <CardContent>
          {beaconsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : beacons.length === 0 ? (
            <p className="text-muted-foreground">No active beacons</p>
          ) : (
            <div className="space-y-4">
              {beacons.slice(0, 5).map((beacon: any) => (
                <div
                  key={beacon.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">{beacon.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {beacon.username}@{beacon.hostname}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      Interval: {beacon.interval}s (+{beacon.jitter}%)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {beacon.last_checkin
                        ? formatRelativeTime(beacon.last_checkin)
                        : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Listeners */}
      <Card>
        <CardHeader>
          <CardTitle>Active Listeners</CardTitle>
        </CardHeader>
        <CardContent>
          {listenersLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : listeners.length === 0 ? (
            <p className="text-muted-foreground">No active listeners</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {listeners.map((listener: any) => (
                <div
                  key={listener.id}
                  className="p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Antenna className="h-4 w-4 text-green-500" />
                    <span className="font-medium uppercase">{listener.protocol}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {listener.host}:{listener.port}
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
