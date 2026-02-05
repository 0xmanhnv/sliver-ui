import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Play,
  FileCode,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import api from '@/services/api'

interface ExecuteAssemblyProps {
  sessionId: string
  sessionType: 'session' | 'beacon'
}

interface RecentAssembly {
  path: string
  args: string
  timestamp: Date
}

// Common .NET tools for quick access
const quickTools = [
  { name: 'Rubeus', command: 'kerberoast', desc: 'Extract service account hashes', category: 'Kerberos' },
  { name: 'Rubeus', command: 'asreproast', desc: 'Find accounts without pre-auth', category: 'Kerberos' },
  { name: 'Seatbelt', command: '-group=all', desc: 'Full system enumeration', category: 'Recon' },
  { name: 'SharpHound', command: '-c All', desc: 'Collect AD data for BloodHound', category: 'AD' },
  { name: 'SharpPersist', command: 'status', desc: 'Check installed persistence', category: 'Persist' },
  { name: 'Certify', command: 'find /vulnerable', desc: 'Find vulnerable certificates', category: 'ADCS' },
]

export function ExecuteAssembly({ sessionId, sessionType }: ExecuteAssemblyProps) {
  const { toast } = useToast()
  const [assemblyPath, setAssemblyPath] = useState('')
  const [arguments_, setArguments] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(true)
  const [recentAssemblies, setRecentAssemblies] = useState<RecentAssembly[]>([])

  const executeMutation = useMutation({
    mutationFn: async () => {
      const endpoint = sessionType === 'session'
        ? `/sessions/${sessionId}/execute-assembly`
        : `/beacons/${sessionId}/tasks/execute-assembly`

      const response = await api.post(endpoint, {
        assembly_path: assemblyPath,
        arguments: arguments_,
      })
      return response.data
    },
    onSuccess: (data) => {
      if (sessionType === 'session') {
        // Direct result for sessions
        setOutput(data.output || data.error || 'Execution complete (no output)')
      } else {
        // Task queued for beacons
        toast({
          title: 'Task Queued',
          description: `Execute-assembly task ${data.task_id} queued for beacon`,
        })
        setOutput(`Task queued: ${data.task_id}\nCheck beacon tasks for results.`)
      }

      // Add to recent
      setRecentAssemblies((prev) => [
        { path: assemblyPath, args: arguments_, timestamp: new Date() },
        ...prev.slice(0, 9), // Keep last 10
      ])
    },
    onError: (error: Error) => {
      toast({
        title: 'Execution Failed',
        description: error.message,
        variant: 'destructive',
      })
      setOutput(`Error: ${error.message}`)
    },
  })

  const handleExecute = () => {
    if (!assemblyPath.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter assembly path',
        variant: 'destructive',
      })
      return
    }
    executeMutation.mutate()
  }

  const handleQuickTool = (tool: typeof quickTools[0]) => {
    setAssemblyPath(`/tools/${tool.name}.exe`)
    setArguments(tool.command)
  }

  const handleRecentClick = (recent: RecentAssembly) => {
    setAssemblyPath(recent.path)
    setArguments(recent.args)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="h-5 w-5" />
          Execute Assembly
        </CardTitle>
        <CardDescription>
          Run .NET assemblies in-memory on the target
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assembly Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Assembly Path</label>
          <Input
            placeholder="/path/to/assembly.exe"
            value={assemblyPath}
            onChange={(e) => setAssemblyPath(e.target.value)}
          />
        </div>

        {/* Arguments Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Arguments</label>
          <Input
            placeholder="arguments (optional)"
            value={arguments_}
            onChange={(e) => setArguments(e.target.value)}
          />
        </div>

        {/* Quick Tools */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick Tools</label>
          <p className="text-xs text-muted-foreground">Click to auto-fill the command</p>
          <div className="flex flex-wrap gap-2">
            {quickTools.map((tool, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => handleQuickTool(tool)}
                className="flex flex-col items-start h-auto py-2 px-3"
                title={tool.desc}
              >
                <span className="text-xs text-muted-foreground">{tool.category}</span>
                <span className="font-medium">{tool.name} {tool.command}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Execute Button */}
        <Button
          onClick={handleExecute}
          disabled={executeMutation.isPending || !assemblyPath.trim()}
          className="w-full"
        >
          {executeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Execute Assembly
            </>
          )}
        </Button>

        {/* Output */}
        {output && (
          <div className="space-y-2">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowOutput(!showOutput)}
            >
              <label className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Output
              </label>
              {showOutput ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            {showOutput && (
              <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {output}
              </pre>
            )}
          </div>
        )}

        {/* Recent Assemblies */}
        {recentAssemblies.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentAssemblies.map((recent, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => handleRecentClick(recent)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono">{recent.path}</p>
                    {recent.args && (
                      <p className="text-xs text-muted-foreground truncate">
                        Args: {recent.args}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">
                    {recent.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          {sessionType === 'session'
            ? 'Assembly will execute immediately and return results.'
            : 'Assembly execution will be queued as a beacon task.'}
        </p>
      </CardContent>
    </Card>
  )
}
