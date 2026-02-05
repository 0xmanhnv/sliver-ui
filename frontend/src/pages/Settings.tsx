import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings as SettingsIcon, User, Shield, Info } from 'lucide-react'

export function Settings() {
  const { user } = useAuthStore()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-sm text-muted-foreground">Username</span>
              <p className="font-medium">{user?.username}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Role</span>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Email</span>
              <p className="font-medium">{user?.email || 'Not set'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">User ID</span>
              <p className="font-medium">{user?.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions
          </CardTitle>
          <CardDescription>
            Your current access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.permissions && user.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.permissions.map((perm) => (
                <span
                  key={perm}
                  className="px-2 py-1 rounded-md bg-muted text-sm font-mono"
                >
                  {perm}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {user?.role === 'admin'
                ? 'Full access (admin)'
                : 'No specific permissions'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About SliverUI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground">Version</span>
            <p className="font-medium">1.0.0</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Description</span>
            <p className="text-muted-foreground">
              SliverUI is a web-based graphical user interface for the Sliver C2
              framework. It provides an intuitive interface for managing sessions,
              beacons, implants, and listeners without requiring deep knowledge of
              CLI commands.
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Features</span>
            <ul className="list-disc list-inside text-muted-foreground mt-1">
              <li>Real-time session and beacon monitoring</li>
              <li>Visual implant builder with form-based configuration</li>
              <li>Listener management with one-click start/stop</li>
              <li>Role-based access control for team collaboration</li>
              <li>Audit logging for compliance</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
