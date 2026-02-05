import { useState, useMemo, useCallback, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { browserOpsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Search,
  Download,
  Trash2,
  Cookie,
  Lock,
  ShieldCheck,
  ClipboardCopy,
  ArrowUpDown,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CookieTableProps {
  cookies: Array<{
    id?: number
    domain: string
    name: string
    value: string
    path: string
    expires?: string
    secure: boolean
    http_only: boolean
    same_site?: string
  }>
  sessionId?: string
  onDelete?: () => void
  onSelectionChange?: (selectedIds: number[]) => void
}

type ExportFormat = 'netscape' | 'json' | 'editthiscookie' | 'header'
type SortDirection = 'asc' | 'desc'

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'netscape':
      return 'txt'
    case 'json':
    case 'editthiscookie':
      return 'json'
    case 'header':
      return 'txt'
  }
}

function getExportMime(format: ExportFormat): string {
  switch (format) {
    case 'json':
    case 'editthiscookie':
      return 'application/json'
    default:
      return 'text/plain'
  }
}

export function CookieTable({ cookies, sessionId, onDelete, onSelectionChange }: CookieTableProps) {
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { toast } = useToast()

  // Filter cookies by search term (domain or name)
  const filteredCookies = useMemo(() => {
    const sorted = [...cookies].sort((a, b) => {
      const comparison = a.domain.localeCompare(b.domain)
      return sortDirection === 'asc' ? comparison : -comparison
    })

    if (!search) return sorted

    const term = search.toLowerCase()
    return sorted.filter(
      (c) =>
        c.domain.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term)
    )
  }, [cookies, search, sortDirection])

  // Check if all visible cookies are selected
  const allSelected =
    filteredCookies.length > 0 &&
    filteredCookies.every((c) => c.id != null && selectedIds.has(c.id))

  // Toggle sort direction
  const toggleSort = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }, [])

  // Toggle a single row selection
  const toggleRow = useCallback((id: number | undefined | null) => {
    if (id == null) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Toggle all visible rows
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      const ids = new Set<number>()
      filteredCookies.forEach((c) => {
        if (c.id != null) ids.add(c.id)
      })
      setSelectedIds(ids)
    }
  }, [allSelected, filteredCookies])

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds))
  }, [selectedIds, onSelectionChange])

  // Copy value to clipboard
  const copyToClipboard = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast({ title: 'Copied to clipboard' })
      } catch {
        toast({ variant: 'destructive', title: 'Failed to copy' })
      }
    },
    [toast]
  )

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: (data: {
      cookie_ids?: number[]
      session_id?: string
      format: string
    }) => browserOpsApi.exportCookies(data),
    onSuccess: (data) => {
      const content = data?.content ?? JSON.stringify(data, null, 2)
      const filename = data?.filename ?? `cookies_export_${Date.now()}.${getExportExtension(exportFormat)}`
      const mime = data?.content_type ?? getExportMime(exportFormat)
      triggerDownload(content, filename, mime)
      toast({
        title: 'Cookies exported',
        description: `${data?.count ?? 0} cookies as ${exportFormat}`,
      })
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to export cookies' })
    },
  })

  // Delete mutation - deletes all cookies for session (API limitation)
  const deleteMutation = useMutation({
    mutationFn: () => browserOpsApi.deleteCookies(sessionId),
    onSuccess: () => {
      toast({ title: 'All cookies deleted for this session' })
      setSelectedIds(new Set())
      onDelete?.()
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to delete cookies' })
    },
  })

  // Confirm before delete
  const handleDelete = () => {
    const msg = `This will delete ALL ${cookies.length} cookies for this session. Continue?`
    if (window.confirm(msg)) {
      deleteMutation.mutate()
    }
  }

  // Handle export
  const handleExport = () => {
    const selectedArray = Array.from(selectedIds)
    exportMutation.mutate({
      cookie_ids: selectedArray.length > 0 ? selectedArray : undefined,
      session_id: sessionId,
      format: exportFormat,
    })
  }

  // Truncate value for display
  const truncateValue = (value: string, max = 40) => {
    if (value.length <= max) return value
    return value.slice(0, max) + '...'
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Extracted Cookies
            <span className="text-sm font-normal text-muted-foreground">
              ({cookies.length})
            </span>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toolbar: search, export controls, bulk delete */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by domain or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Export format select + download button */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className={cn(
                  'h-9 rounded-md border border-input bg-background px-3 pr-8 text-sm',
                  'appearance-none cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <option value="json">JSON</option>
                <option value="netscape">Netscape</option>
                <option value="editthiscookie">EditThisCookie</option>
                <option value="header">Cookie Header</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportMutation.isPending || cookies.length === 0}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
          </div>

          {/* Delete all cookies for session */}
          {cookies.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Clear All
            </Button>
          )}

          <div className="flex-1" />

          <span className="text-sm text-muted-foreground">
            {filteredCookies.length} of {cookies.length} cookies
          </span>
        </div>

        {/* Cookie table */}
        {cookies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Cookie className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No cookies extracted yet</p>
            <p className="text-xs mt-1">
              Use the extract panel above to pull cookies from a target browser.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  {/* Select all checkbox */}
                  <th className="p-2 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                  </th>

                  {/* Domain - sortable */}
                  <th
                    className="p-2 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none"
                    onClick={toggleSort}
                  >
                    <div className="flex items-center gap-1">
                      Domain
                      <ArrowUpDown
                        className={cn(
                          'h-3 w-3',
                          sortDirection === 'desc' && 'rotate-180'
                        )}
                      />
                    </div>
                  </th>

                  <th className="p-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="p-2 font-medium text-muted-foreground">
                    Value
                  </th>
                  <th className="p-2 font-medium text-muted-foreground">
                    Path
                  </th>
                  <th className="p-2 font-medium text-muted-foreground text-center w-16">
                    Secure
                  </th>
                  <th className="p-2 font-medium text-muted-foreground text-center w-20">
                    HttpOnly
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCookies.map((cookie, idx) => {
                  const isSelected =
                    cookie.id != null && selectedIds.has(cookie.id)

                  return (
                    <tr
                      key={cookie.id ?? `${cookie.domain}-${cookie.name}-${idx}`}
                      className={cn(
                        'border-b border-border/50 transition-colors',
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                      )}
                    >
                      {/* Row checkbox */}
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(cookie.id)}
                          disabled={cookie.id == null}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </td>

                      {/* Domain */}
                      <td className="p-2 font-mono text-xs whitespace-nowrap">
                        {cookie.domain}
                      </td>

                      {/* Name */}
                      <td className="p-2 font-medium whitespace-nowrap">
                        {cookie.name}
                      </td>

                      {/* Value - truncated with copy */}
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span
                            className="font-mono text-xs text-muted-foreground truncate max-w-[280px] cursor-pointer hover:text-foreground"
                            title={cookie.value}
                            onClick={() => copyToClipboard(cookie.value)}
                          >
                            {truncateValue(cookie.value)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => copyToClipboard(cookie.value)}
                          >
                            <ClipboardCopy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>

                      {/* Path */}
                      <td className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {cookie.path}
                      </td>

                      {/* Secure */}
                      <td className="p-2 text-center">
                        {cookie.secure && (
                          <Lock className="h-4 w-4 text-green-500 mx-auto" />
                        )}
                      </td>

                      {/* HttpOnly */}
                      <td className="p-2 text-center">
                        {cookie.http_only && (
                          <ShieldCheck className="h-4 w-4 text-blue-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  )
                })}

                {filteredCookies.length === 0 && cookies.length > 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No cookies match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
