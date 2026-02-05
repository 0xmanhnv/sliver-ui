import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { UserManagement } from '@/components/admin/UserManagement'
import { AuditLogs } from '@/components/admin/AuditLogs'
import { cn } from '@/lib/utils'
import {
  Users,
  FileText,
  Shield,
  Settings,
} from 'lucide-react'

type TabType = 'users' | 'audit'

export function Admin() {
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const { user } = useAuth()

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto text-destructive/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You do not have permission to access this page.
            <br />
            Admin privileges are required.
          </p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'users' as const, label: 'User Management', icon: Users },
    { id: 'audit' as const, label: 'Audit Logs', icon: FileText },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
            <p className="text-sm text-muted-foreground">
              Manage users and view system activity
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'audit' && <AuditLogs />}
      </div>
    </div>
  )
}
