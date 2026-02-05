import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Users,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

interface User {
  id: number
  username: string
  email?: string
  role: { id: number; name: string }
  is_active: boolean
  created_at: string
  last_login?: string
}

interface Role {
  id: number
  name: string
  description?: string
}

export function UserManagement() {
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role_id: 2, // Default to operator
  })
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: usersApi.roles,
  })

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User created successfully' })
      resetForm()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create user',
        description: error.response?.data?.detail,
      })
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User updated successfully' })
      resetForm()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update user',
        description: error.response?.data?.detail,
      })
    },
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User deleted' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to delete user',
        description: error.response?.data?.detail,
      })
    },
  })

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      usersApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const users: User[] = usersData?.users || []
  const roles: Role[] = rolesData || []

  const resetForm = () => {
    setShowForm(false)
    setEditingUser(null)
    setFormData({ username: '', email: '', password: '', role_id: 2 })
    setShowPassword(false)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      role_id: user.role.id,
    })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (editingUser) {
      const updateData: any = {}
      if (formData.username !== editingUser.username) updateData.username = formData.username
      if (formData.email !== (editingUser.email || '')) updateData.email = formData.email
      if (formData.password) updateData.password = formData.password
      if (formData.role_id !== editingUser.role.id) updateData.role_id = formData.role_id

      updateMutation.mutate({ id: editingUser.id, data: updateData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return <ShieldCheck className="h-4 w-4 text-red-500" />
      case 'operator':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'viewer':
        return <ShieldX className="h-4 w-4 text-gray-500" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h2 className="text-2xl font-bold">User Management</h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* User form */}
      {showForm && (
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-medium mb-4">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Username *</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Password {editingUser ? '(leave blank to keep)' : '*'}
              </label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Role *</label>
              <select
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2"
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: parseInt(e.target.value) })}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} {role.description && `- ${role.description}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSubmit} disabled={isPending || !formData.username}>
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {editingUser ? 'Update' : 'Create'}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 font-medium">Last Login</th>
              <th className="p-3 font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t hover:bg-muted/50">
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{user.username}</p>
                      {user.email && (
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role.name)}
                      <span className="capitalize">{user.role.name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          id: user.id,
                          is_active: !user.is_active,
                        })
                      }
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium transition-colors',
                        user.is_active
                          ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
                      )}
                    >
                      {user.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {user.last_login ? formatDate(user.last_login) : 'Never'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete user ${user.username}?`)) {
                            deleteMutation.mutate(user.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Roles info */}
      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((role) => (
          <div key={role.id} className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {getRoleIcon(role.name)}
              <span className="font-medium capitalize">{role.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {role.description || 'No description'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
