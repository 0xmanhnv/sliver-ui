import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Edit2,
  Trash2,
  Save,
  X,
  Search,
} from 'lucide-react'

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

interface ImplantTableProps {
  implants: TrackedImplant[]
  onUpdate: (id: number, data: Record<string, unknown>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const STATUS_COLORS: Record<string, string> = {
  built: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  deployed: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  active: 'bg-green-500/20 text-green-600 dark:text-green-400',
  compromised: 'bg-red-500/20 text-red-600 dark:text-red-400',
  retired: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
}

export function ImplantTable({ implants, onUpdate, onDelete }: ImplantTableProps) {
  const { toast } = useToast()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  const startEdit = (implant: TrackedImplant) => {
    setEditingId(implant.id)
    setEditData({
      status: implant.status,
      notes: implant.notes || '',
      deployed_target: implant.deployed_target || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const saveEdit = async (id: number) => {
    try {
      await onUpdate(id, editData)
      setEditingId(null)
      setEditData({})
      toast({ title: 'Implant updated' })
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' })
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Retire implant "${name}"? This is a soft delete.`)) return
    try {
      await onDelete(id)
      toast({ title: `Implant "${name}" retired` })
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' })
    }
  }

  const filtered = implants.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.deployed_target || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search implants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Version</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Target</th>
                <th className="text-left p-3 font-medium">C2 Domains</th>
                <th className="text-left p-3 font-medium">Notes</th>
                <th className="text-left p-3 font-medium">Updated</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {searchTerm ? 'No implants match your search' : 'No implants tracked yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((implant) => (
                  <tr key={implant.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <span className="font-mono font-medium">{implant.name}</span>
                      {implant.sha256_hash && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {implant.sha256_hash.substring(0, 16)}...
                        </p>
                      )}
                    </td>
                    <td className="p-3">{implant.version}</td>
                    <td className="p-3">
                      {editingId === implant.id ? (
                        <select
                          className="h-8 rounded border bg-background px-2 text-sm"
                          value={editData.status}
                          onChange={(e) =>
                            setEditData({ ...editData, status: e.target.value })
                          }
                        >
                          <option value="built">Built</option>
                          <option value="deployed">Deployed</option>
                          <option value="active">Active</option>
                          <option value="compromised">Compromised</option>
                          <option value="retired">Retired</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[implant.status] || ''}`}
                        >
                          {implant.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === implant.id ? (
                        <Input
                          className="h-8 text-sm"
                          value={editData.deployed_target}
                          onChange={(e) =>
                            setEditData({ ...editData, deployed_target: e.target.value })
                          }
                          placeholder="target hostname"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {implant.deployed_target || '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {implant.c2_domains?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {implant.c2_domains.map((d, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[200px]">
                      {editingId === implant.id ? (
                        <Input
                          className="h-8 text-sm"
                          value={editData.notes}
                          onChange={(e) =>
                            setEditData({ ...editData, notes: e.target.value })
                          }
                          placeholder="notes"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs truncate block">
                          {implant.notes || '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(implant.updated_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {editingId === implant.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => saveEdit(implant.id)}>
                            <Save className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(implant)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(implant.id, implant.name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
