import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notesApi } from '@/services/api'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  History,
  Search,
  Copy,
  Download,
  Terminal,
  Clock,
  User,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface CommandHistoryProps {
  sessionId: string
  sessionType: 'session' | 'beacon'
}

interface CommandEntry {
  id: number
  session_id: string
  command: string
  output?: string
  exit_code?: number
  username: string
  executed_at: string
}

export function CommandHistory({ sessionId, sessionType }: CommandHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<CommandEntry | null>(null)
  const { toast } = useToast()

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['command-history', sessionId],
    queryFn: () => notesApi.getCommandHistory(sessionId),
  })

  const filteredHistory = history.filter((cmd: CommandEntry) =>
    cmd.command.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  const exportHistory = () => {
    const content = history.map((cmd: CommandEntry) =>
      `[${format(new Date(cmd.executed_at), 'yyyy-MM-dd HH:mm:ss')}] (${cmd.username}) $ ${cmd.command}\n${cmd.output || ''}\nExit Code: ${cmd.exit_code ?? 'N/A'}\n${'='.repeat(80)}\n`
    ).join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `command-history-${sessionId}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'History exported' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Command History ({filteredHistory.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportHistory}
            disabled={history.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* History Table */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading history...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? 'No matching commands' : 'No command history'}
          </div>
        ) : (
          <div className="rounded-md border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Status</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead className="w-[120px]">User</TableHead>
                  <TableHead className="w-[150px]">Time</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((cmd: CommandEntry) => (
                  <TableRow key={cmd.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      {cmd.exit_code === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : cmd.exit_code !== null && cmd.exit_code !== undefined ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          N/A
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2 max-w-[400px]">
                        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{cmd.command}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        {cmd.username}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(cmd.executed_at), 'MMM d, HH:mm')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(cmd.command)
                          }}
                          title="Copy command"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setSelectedCommand(cmd)}
                              title="View details"
                            >
                              <Terminal className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                              <DialogTitle>Command Details</DialogTitle>
                            </DialogHeader>
                            {selectedCommand && (
                              <div className="space-y-4 overflow-auto flex-1">
                                {/* Command */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Command</label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(selectedCommand.command)}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <pre className="p-3 rounded-lg bg-muted font-mono text-sm whitespace-pre-wrap break-all">
                                    $ {selectedCommand.command}
                                  </pre>
                                </div>

                                {/* Output */}
                                {selectedCommand.output && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="text-sm font-medium">Output</label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(selectedCommand.output || '')}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy
                                      </Button>
                                    </div>
                                    <pre className="p-3 rounded-lg bg-black text-green-400 font-mono text-sm whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
                                      {selectedCommand.output}
                                    </pre>
                                  </div>
                                )}

                                {/* Metadata */}
                                <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
                                  <span className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    {selectedCommand.username}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {format(new Date(selectedCommand.executed_at), 'PPpp')}
                                  </span>
                                  <Badge
                                    variant={selectedCommand.exit_code === 0 ? 'default' : 'destructive'}
                                  >
                                    Exit Code: {selectedCommand.exit_code ?? 'N/A'}
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
