import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileText,
  RefreshCw,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface AuditLog {
  id: number
  user_id: number
  username?: string
  action: string
  resource: string
  resource_id?: string
  details?: any
  ip_address?: string
  created_at: string
}

export function AuditLogs() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50
  const accessToken = useAuthStore((state) => state.accessToken)

  // Fetch audit logs (needs backend endpoint)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, resourceFilter],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/audit?page=${page}&page_size=${pageSize}` +
          (search ? `&search=${encodeURIComponent(search)}` : '') +
          (actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : '') +
          (resourceFilter ? `&resource=${encodeURIComponent(resourceFilter)}` : ''),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      if (!response.ok) throw new Error('Failed to fetch audit logs')
      return response.json()
    },
  })

  const logs: AuditLog[] = data?.logs || []
  const totalPages = Math.ceil((data?.total || 0) / pageSize)

  // Get unique actions and resources for filters
  const actions = ['login', 'logout', 'shell', 'kill', 'download', 'upload', 'generate', 'create', 'update', 'delete']
  const resources = ['auth', 'sessions', 'beacons', 'implants', 'listeners', 'files', 'users']

  // Export to CSV
  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Details']
    const rows = logs.map((log) => [
      log.id,
      log.created_at,
      log.username || log.user_id,
      log.action,
      log.resource,
      log.resource_id || '',
      log.ip_address || '',
      JSON.stringify(log.details || {}),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Get action color
  const getActionColor = (action: string) => {
    switch (action) {
      case 'login':
      case 'create':
        return 'text-green-500 bg-green-500/10'
      case 'logout':
        return 'text-blue-500 bg-blue-500/10'
      case 'delete':
      case 'kill':
        return 'text-red-500 bg-red-500/10'
      case 'shell':
      case 'execute':
        return 'text-yellow-500 bg-yellow-500/10'
      case 'download':
      case 'upload':
        return 'text-purple-500 bg-purple-500/10'
      default:
        return 'text-gray-500 bg-gray-500/10'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Audit Logs</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-card">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div className="w-40">
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Resources</option>
            {resources.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>
        </div>

        {(search || actionFilter || resourceFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setActionFilter('')
              setResourceFilter('')
              setPage(1)
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Logs table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3 font-medium">
                <Calendar className="h-4 w-4 inline mr-1" />
                Timestamp
              </th>
              <th className="p-3 font-medium">
                <User className="h-4 w-4 inline mr-1" />
                User
              </th>
              <th className="p-3 font-medium">
                <Activity className="h-4 w-4 inline mr-1" />
                Action
              </th>
              <th className="p-3 font-medium">Resource</th>
              <th className="p-3 font-medium">Details</th>
              <th className="p-3 font-medium">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="p-3">
                    <span className="font-medium">{log.username || `User #${log.user_id}`}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getActionColor(log.action)
                      )}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-muted-foreground">{log.resource}</span>
                    {log.resource_id && (
                      <span className="ml-1 font-mono text-xs">#{log.resource_id}</span>
                    )}
                  </td>
                  <td className="p-3 max-w-xs">
                    {log.details && (
                      <pre className="text-xs text-muted-foreground truncate">
                        {JSON.stringify(log.details)}
                      </pre>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total || 0} total logs)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
