import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { ImplantTable } from '@/components/implants/ImplantTable'
import {
  Package,
  Plus,
  Loader2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Archive,
} from 'lucide-react'
import api from '@/services/api'

interface TrackedImplant {
  id: number
  name: string
  version: string
  build_date: string | null
  c2_domains: string[] | null
  deployed_target: string | null
  status: string
  notes: string | null
  sha256_hash: string | null
  created_at: string
  updated_at: string
}

interface ImplantListResponse {
  implants: TrackedImplant[]
  total: number
}

const trackingApi = {
  list: async (status?: string): Promise<ImplantListResponse> => {
    const params = status ? { status } : {}
    const { data } = await api.get('/implant-tracking/', { params })
    return data
  },
  create: async (payload: Record<string, unknown>): Promise<TrackedImplant> => {
    const { data } = await api.post('/implant-tracking/', payload)
    return data
  },
  update: async (id: number, payload: Record<string, unknown>): Promise<TrackedImplant> => {
    const { data } = await api.patch(`/implant-tracking/${id}`, payload)
    return data
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/implant-tracking/${id}`)
  },
}

export function ImplantTracking() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  // Form state
  const [newName, setNewName] = useState('')
  const [newVersion, setNewVersion] = useState('1.0')
  const [newDomains, setNewDomains] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newHash, setNewHash] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['implant-tracking', statusFilter],
    queryFn: () => trackingApi.list(statusFilter),
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => trackingApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implant-tracking'] })
      toast({ title: 'Implant tracked successfully' })
      setShowCreateForm(false)
      setNewName('')
      setNewVersion('1.0')
      setNewDomains('')
      setNewTarget('')
      setNewNotes('')
      setNewHash('')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const handleCreate = () => {
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName.trim(),
      version: newVersion,
      c2_domains: newDomains ? newDomains.split(',').map((d) => d.trim()) : null,
      deployed_target: newTarget || null,
      notes: newNotes || null,
      sha256_hash: newHash || null,
    })
  }

  const handleUpdate = async (id: number, updateData: Record<string, unknown>) => {
    await trackingApi.update(id, updateData)
    queryClient.invalidateQueries({ queryKey: ['implant-tracking'] })
  }

  const handleDelete = async (id: number) => {
    await trackingApi.remove(id)
    queryClient.invalidateQueries({ queryKey: ['implant-tracking'] })
  }

  // Status counts
  const implants = data?.implants || []
  const activeCount = implants.filter((i) => i.status === 'active').length
  const deployedCount = implants.filter((i) => i.status === 'deployed').length
  const compromisedCount = implants.filter((i) => i.status === 'compromised').length
  const builtCount = implants.filter((i) => i.status === 'built').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Implant Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Track implant lifecycle from build to retirement
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Track New Implant
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'active' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'active' ? undefined : 'active')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'deployed' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'deployed' ? undefined : 'deployed')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{deployedCount}</p>
              <p className="text-xs text-muted-foreground">Deployed</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'compromised' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'compromised' ? undefined : 'compromised')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{compromisedCount}</p>
              <p className="text-xs text-muted-foreground">Compromised</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${statusFilter === 'built' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'built' ? undefined : 'built')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Archive className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{builtCount}</p>
              <p className="text-xs text-muted-foreground">Built</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Track New Implant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  placeholder="beacon-win-prod-01"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Version</label>
                <Input
                  placeholder="1.0"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">C2 Domains (comma-separated)</label>
                <Input
                  placeholder="cdn.example.com, static.example.com"
                  value={newDomains}
                  onChange={(e) => setNewDomains(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Deployed Target</label>
                <Input
                  placeholder="WORKSTATION-01"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">SHA256 Hash</label>
                <Input
                  placeholder="abc123..."
                  value={newHash}
                  onChange={(e) => setNewHash(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input
                  placeholder="Initial deployment for Phase 1"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Track Implant
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implant Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tracked Implants
              {statusFilter && (
                <span className="text-sm font-normal text-muted-foreground">
                  (filtered: {statusFilter})
                </span>
              )}
            </span>
            {statusFilter && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter(undefined)}>
                Clear filter
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ImplantTable
              implants={implants}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
