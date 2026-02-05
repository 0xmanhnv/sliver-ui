import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { beaconsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Download,
  Camera,
  Cpu,
  Send,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'

interface BeaconTask {
  id: string
  beacon_id: string
  state: string
  created_at: string
  sent_at?: string
  completed_at?: string
  request?: any
  response?: any
  description?: string
  error?: string
}

interface BeaconTaskQueueProps {
  beaconId: string
  beaconName?: string
}

type TaskType = 'shell' | 'download' | 'ps' | 'screenshot'

export function BeaconTaskQueue({ beaconId, beaconName }: BeaconTaskQueueProps) {
  const [showNewTask, setShowNewTask] = useState(false)
  const [taskType, setTaskType] = useState<TaskType>('shell')
  const [command, setCommand] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch tasks
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['beacon-tasks', beaconId],
    queryFn: () => beaconsApi.getTasks(beaconId),
    enabled: !!beaconId,
    refetchInterval: 5000,
  })

  // Queue shell task mutation
  const queueShellMutation = useMutation({
    mutationFn: (cmd: string) => beaconsApi.queueShell(beaconId, cmd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beacon-tasks', beaconId] })
      toast({ title: 'Shell task queued' })
      setShowNewTask(false)
      setCommand('')
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to queue task',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Queue ps task mutation
  const queuePsMutation = useMutation({
    mutationFn: () => beaconsApi.queuePs(beaconId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beacon-tasks', beaconId] })
      toast({ title: 'Process list task queued' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to queue task',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Queue screenshot task mutation
  const queueScreenshotMutation = useMutation({
    mutationFn: () => beaconsApi.queueScreenshot(beaconId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beacon-tasks', beaconId] })
      toast({ title: 'Screenshot task queued' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to queue task',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  // Queue download task mutation
  const queueDownloadMutation = useMutation({
    mutationFn: (path: string) => beaconsApi.queueDownload(beaconId, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beacon-tasks', beaconId] })
      toast({ title: 'Download task queued' })
      setShowNewTask(false)
      setRemotePath('')
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to queue task',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const tasks: BeaconTask[] = data?.tasks || []

  const getTaskIcon = (description: string | undefined) => {
    const desc = description?.toLowerCase() || ''
    if (desc.includes('shell') || desc.includes('execute')) return <Terminal className="h-4 w-4" />
    if (desc.includes('download')) return <Download className="h-4 w-4" />
    if (desc.includes('screenshot')) return <Camera className="h-4 w-4" />
    if (desc.includes('ps') || desc.includes('process')) return <Cpu className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  const getStateIcon = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'sent':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStateColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-600'
      case 'sent':
        return 'bg-blue-500/20 text-blue-600'
      case 'completed':
        return 'bg-green-500/20 text-green-600'
      case 'failed':
        return 'bg-red-500/20 text-red-600'
      default:
        return 'bg-gray-500/20 text-gray-600'
    }
  }

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  const handleQueueTask = () => {
    switch (taskType) {
      case 'shell':
        if (command) queueShellMutation.mutate(command)
        break
      case 'download':
        if (remotePath) queueDownloadMutation.mutate(remotePath)
        break
      case 'ps':
        queuePsMutation.mutate()
        break
      case 'screenshot':
        queueScreenshotMutation.mutate()
        break
    }
  }

  const isPending = queueShellMutation.isPending || queuePsMutation.isPending ||
    queueScreenshotMutation.isPending || queueDownloadMutation.isPending

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <h3 className="font-medium">Task Queue</h3>
        <span className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setShowNewTask(!showNewTask)}>
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      {/* New task form */}
      {showNewTask && (
        <div className="p-4 border-b bg-muted/30 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={taskType === 'shell' ? 'default' : 'outline'}
              onClick={() => setTaskType('shell')}
            >
              <Terminal className="h-4 w-4 mr-1" />
              Shell
            </Button>
            <Button
              size="sm"
              variant={taskType === 'ps' ? 'default' : 'outline'}
              onClick={() => setTaskType('ps')}
            >
              <Cpu className="h-4 w-4 mr-1" />
              Process List
            </Button>
            <Button
              size="sm"
              variant={taskType === 'screenshot' ? 'default' : 'outline'}
              onClick={() => setTaskType('screenshot')}
            >
              <Camera className="h-4 w-4 mr-1" />
              Screenshot
            </Button>
            <Button
              size="sm"
              variant={taskType === 'download' ? 'default' : 'outline'}
              onClick={() => setTaskType('download')}
            >
              <Download className="h-4 w-4 mr-1" />
              Download File
            </Button>
          </div>

          {taskType === 'shell' && (
            <div>
              <label className="text-sm font-medium">Command</label>
              <Input
                placeholder="whoami"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="mt-1 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && command) handleQueueTask()
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Command will execute on next beacon check-in
              </p>
            </div>
          )}

          {taskType === 'download' && (
            <div>
              <label className="text-sm font-medium">Remote Path</label>
              <Input
                placeholder="/etc/passwd or C:\Windows\System32\config\SAM"
                value={remotePath}
                onChange={(e) => setRemotePath(e.target.value)}
                className="mt-1 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && remotePath) handleQueueTask()
                }}
              />
            </div>
          )}

          {(taskType === 'ps' || taskType === 'screenshot') && (
            <p className="text-sm text-muted-foreground">
              {taskType === 'ps' ? 'List running processes on target' : 'Capture screenshot from target'}
              {' - Will execute on next check-in'}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleQueueTask}
              disabled={isPending || (taskType === 'shell' && !command) || (taskType === 'download' && !remotePath)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Queue Task
            </Button>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/20">
        <span className="text-xs text-muted-foreground">Quick:</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => queueShellMutation.mutate('whoami')}
          disabled={isPending}
        >
          whoami
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => queueShellMutation.mutate('hostname')}
          disabled={isPending}
        >
          hostname
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => queuePsMutation.mutate()}
          disabled={isPending}
        >
          <Cpu className="h-3 w-3 mr-1" />
          ps
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => queueScreenshotMutation.mutate()}
          disabled={isPending}
        >
          <Camera className="h-3 w-3 mr-1" />
          screenshot
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Clock className="h-12 w-12 mb-2 opacity-30" />
            <p>No tasks queued</p>
            <p className="text-sm">Tasks will execute on next beacon check-in</p>
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const isExpanded = expandedTasks.has(task.id)
              return (
                <div key={task.id} className="hover:bg-muted/30 transition-colors">
                  <div
                    className="p-3 cursor-pointer flex items-center gap-3"
                    onClick={() => toggleTaskExpanded(task.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    {getTaskIcon(task.description)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {task.description || 'Task'}
                        </span>
                        {getStateIcon(task.state)}
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', getStateColor(task.state))}>
                          {task.state}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(task.created_at)}
                    </span>
                  </div>

                  {/* Expanded task details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pl-10 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Task ID:</span>
                          <p className="font-mono text-xs">{task.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <p className="text-xs">{new Date(task.created_at).toLocaleString()}</p>
                        </div>
                        {task.sent_at && (
                          <div>
                            <span className="text-muted-foreground">Sent:</span>
                            <p className="text-xs">{new Date(task.sent_at).toLocaleString()}</p>
                          </div>
                        )}
                        {task.completed_at && (
                          <div>
                            <span className="text-muted-foreground">Completed:</span>
                            <p className="text-xs">{new Date(task.completed_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      {task.request && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Request</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(JSON.stringify(task.request, null, 2))
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="p-2 bg-black/50 rounded text-xs text-green-400 overflow-auto max-h-32">
                            {JSON.stringify(task.request, null, 2)}
                          </pre>
                        </div>
                      )}

                      {task.response && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Response</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(
                                  typeof task.response === 'string'
                                    ? task.response
                                    : JSON.stringify(task.response, null, 2)
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="p-2 bg-black/50 rounded text-xs text-green-400 overflow-auto max-h-48">
                            {typeof task.response === 'string'
                              ? task.response
                              : JSON.stringify(task.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {task.error && (
                        <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                          <span className="text-sm text-red-500 font-medium">Error:</span>
                          <p className="text-sm text-red-400 mt-1">{task.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground bg-muted/30 flex items-center justify-between">
        <span>
          {tasks.filter(t => t.state === 'pending').length} pending,{' '}
          {tasks.filter(t => t.state === 'completed').length} completed
        </span>
        <span>Auto-refresh: 5s</span>
      </div>
    </div>
  )
}
