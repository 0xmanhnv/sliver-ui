import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  RefreshCw,
  Search,
  Skull,
  Cpu,
  ArrowUpDown,
  Loader2,
  User,
  Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Process {
  pid: number
  ppid: number
  executable: string
  owner: string
  architecture: string
  session_id?: number
}

interface ProcessListProps {
  sessionId: string
  sessionPid?: number
}

type SortField = 'pid' | 'executable' | 'owner'
type SortDirection = 'asc' | 'desc'

export function ProcessList({ sessionId, sessionPid }: ProcessListProps) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('pid')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch processes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['processes', sessionId],
    queryFn: () => sessionsApi.processes(sessionId),
    enabled: !!sessionId,
  })

  // Kill process mutation
  const killMutation = useMutation({
    mutationFn: (pid: number) => sessionsApi.killProcess(sessionId, pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes', sessionId] })
      toast({ title: 'Process killed' })
      setSelectedPid(null)
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to kill process' })
    },
  })

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter and sort processes
  const processes: Process[] = data?.processes || []
  const filteredProcesses = processes
    .filter((p) => {
      if (!search) return true
      const searchLower = search.toLowerCase()
      return (
        p.executable.toLowerCase().includes(searchLower) ||
        p.owner.toLowerCase().includes(searchLower) ||
        p.pid.toString().includes(search)
      )
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'pid':
          comparison = a.pid - b.pid
          break
        case 'executable':
          comparison = a.executable.localeCompare(b.executable)
          break
        case 'owner':
          comparison = a.owner.localeCompare(b.owner)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

  // Get process tree (simple)
  const getChildren = (pid: number) => processes.filter((p) => p.ppid === pid)

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="p-2 font-medium cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className={cn('h-3 w-3', sortDirection === 'desc' && 'rotate-180')} />
        )}
      </div>
    </th>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search processes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>

        {selectedPid && selectedPid !== sessionPid && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => killMutation.mutate(selectedPid)}
            disabled={killMutation.isPending}
          >
            {killMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Skull className="h-4 w-4 mr-1" />
            )}
            Kill PID {selectedPid}
          </Button>
        )}

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground">
          {filteredProcesses.length} of {processes.length} processes
        </span>
      </div>

      {/* Process table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <SortHeader field="pid">
                  <Hash className="h-3 w-3" /> PID
                </SortHeader>
                <th className="p-2 font-medium">PPID</th>
                <SortHeader field="executable">
                  <Cpu className="h-3 w-3" /> Process
                </SortHeader>
                <SortHeader field="owner">
                  <User className="h-3 w-3" /> Owner
                </SortHeader>
                <th className="p-2 font-medium">Arch</th>
                <th className="p-2 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.map((proc) => {
                const isImplant = proc.pid === sessionPid
                const isSelected = selectedPid === proc.pid

                return (
                  <tr
                    key={proc.pid}
                    className={cn(
                      'border-b border-border/50 cursor-pointer transition-colors',
                      isImplant && 'bg-green-500/10',
                      isSelected && !isImplant && 'bg-primary/10',
                      !isImplant && !isSelected && 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedPid(proc.pid)}
                  >
                    <td className="p-2 font-mono">
                      <div className="flex items-center gap-2">
                        {isImplant && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-500 text-white rounded">
                            IMPLANT
                          </span>
                        )}
                        {proc.pid}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-muted-foreground">
                      {proc.ppid}
                    </td>
                    <td className="p-2">
                      <span className={cn(isImplant && 'font-medium text-green-600')}>
                        {proc.executable || '(unknown)'}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">{proc.owner}</td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
                        {proc.architecture}
                      </span>
                    </td>
                    <td className="p-2">
                      {!isImplant && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            killMutation.mutate(proc.pid)
                          }}
                          disabled={killMutation.isPending}
                        >
                          <Skull className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!isLoading && filteredProcesses.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Cpu className="h-12 w-12 mb-2 opacity-30" />
            <p>No processes found</p>
          </div>
        )}
      </div>

      {/* Selected process details */}
      {selectedPid && (
        <div className="border-t p-3 bg-muted/30">
          {(() => {
            const proc = processes.find((p) => p.pid === selectedPid)
            if (!proc) return null
            const children = getChildren(selectedPid)

            return (
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">PID:</span>
                  <p className="font-mono">{proc.pid}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Parent PID:</span>
                  <p className="font-mono">{proc.ppid}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Executable:</span>
                  <p className="truncate">{proc.executable}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Child Processes:</span>
                  <p>{children.length}</p>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
