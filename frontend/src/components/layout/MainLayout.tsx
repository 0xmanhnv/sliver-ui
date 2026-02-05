import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { StatusLegend } from '@/components/common/StatusLegend'
import { WelcomeTour, useTour } from '@/components/onboarding/WelcomeTour'
import { HelpCenter, HelpButton } from '@/components/help/HelpCenter'
import { NotificationBell } from '@/components/notifications/NotificationCenter'
import { useKeyboardShortcuts, KeyboardShortcutsHelp, PendingKeyIndicator } from '@/components/common/KeyboardShortcuts'
import { sessionsApi, beaconsApi, cleanupApi } from '@/services/api'
import {
  LayoutDashboard,
  Monitor,
  Radio,
  Package,
  Antenna,
  Puzzle,
  Trash2,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Wifi,
  WifiOff,
  HelpCircle,
  RotateCcw,
  Keyboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'System overview' },
  { path: '/sessions', icon: Monitor, label: 'Sessions', desc: 'Live connections' },
  { path: '/beacons', icon: Radio, label: 'Beacons', desc: 'Scheduled callbacks' },
  { path: '/implants', icon: Package, label: 'Implants', desc: 'Generate payloads' },
  { path: '/listeners', icon: Antenna, label: 'Listeners', desc: 'Receive connections' },
  { path: '/armory', icon: Puzzle, label: 'Tools', desc: 'Extensions & utilities' },
  { path: '/cleanup', icon: Trash2, label: 'Cleanup', desc: 'Manage connections' },
  { path: '/settings', icon: Settings, label: 'Settings', desc: 'Preferences' },
]

// Badge component for nav items
function NavBadge({ count, variant = 'default' }: { count: number; variant?: 'default' | 'warning' | 'danger' }) {
  if (count === 0) return null

  const colors = {
    default: 'bg-primary text-primary-foreground',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-500 text-white',
  }

  return (
    <span className={cn(
      'ml-auto px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[20px] text-center',
      colors[variant]
    )}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { isConnected } = useWebSocket()
  const { showTour, completeTour, skipTour, restartTour } = useTour()
  const { showHelp: showShortcuts, setShowHelp: setShowShortcuts, pendingKey } = useKeyboardShortcuts()

  // Fetch counts for badges
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
    refetchInterval: 30000,
  })

  const { data: beaconsData } = useQuery({
    queryKey: ['beacons'],
    queryFn: beaconsApi.list,
    refetchInterval: 30000,
  })

  const { data: cleanupData } = useQuery({
    queryKey: ['cleanup-status'],
    queryFn: () => cleanupApi.getStatus(),
    refetchInterval: 60000,
  })

  const sessionCount = sessionsData?.sessions?.length || 0
  const beaconCount = beaconsData?.beacons?.length || 0
  const cleanupCount = (cleanupData?.stale_sessions?.length || 0) + (cleanupData?.dead_beacons?.length || 0)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Check if user is admin to show admin link
  const isAdmin = user?.role === 'admin'

  // Get badge for nav item
  const getBadge = (path: string) => {
    switch (path) {
      case '/sessions':
        return <NavBadge count={sessionCount} />
      case '/beacons':
        return <NavBadge count={beaconCount} />
      case '/cleanup':
        return <NavBadge count={cleanupCount} variant={cleanupCount > 0 ? 'warning' : 'default'} />
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Welcome Tour */}
      {showTour && (
        <WelcomeTour onComplete={completeTour} onSkip={skipTour} />
      )}

      {/* Help Center */}
      {showHelp && <HelpCenter onClose={() => setShowHelp(false)} />}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {sidebarOpen && (
            <div>
              <span className="text-xl font-bold text-primary">SliverUI</span>
              <p className="text-xs text-muted-foreground">Web GUI for Sliver C2</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground group',
                  isActive && 'bg-accent text-accent-foreground',
                  !sidebarOpen && 'justify-center'
                )
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="block">{item.label}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                      {item.desc}
                    </span>
                  </div>
                  {getBadge(item.path)}
                </>
              )}
              {!sidebarOpen && getBadge(item.path)}
            </NavLink>
          ))}

          {/* Admin link - only show for admins */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                  !sidebarOpen && 'justify-center'
                )
              }
              title={!sidebarOpen ? 'Admin' : undefined}
            >
              <Shield className="h-5 w-5 shrink-0" />
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <span className="block">Admin</span>
                  <span className="text-xs text-muted-foreground">
                    System management
                  </span>
                </div>
              )}
            </NavLink>
          )}
        </nav>

        {/* Help & Tour */}
        {sidebarOpen && (
          <div className="px-4 py-2 border-t space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowHelp(true)}
              aria-label="Open help center"
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Help Center
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setShowShortcuts(true)}
              aria-label="Show keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Shortcuts
              <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={restartTour}
              aria-label="Restart tutorial"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Tutorial
            </Button>
          </div>
        )}

        {/* Connection status, Notifications & Theme toggle */}
        <div className="px-4 py-3 border-t">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
            {/* Connection status */}
            <div
              className={cn(
                'flex items-center gap-2',
                isConnected ? 'text-green-500' : 'text-red-500'
              )}
              title={isConnected ? 'Connected to server' : 'Disconnected from server'}
            >
              {isConnected ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4 animate-pulse" />
              )}
              {sidebarOpen && (
                <span className="text-xs">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              )}
            </div>

            {/* Notifications & Theme toggle */}
            {sidebarOpen && (
              <div className="flex-1 flex items-center justify-end gap-1">
                <NotificationBell />
                <ThemeToggle variant="icon" />
              </div>
            )}
          </div>
        </div>

        {/* User section */}
        <div className="border-t p-4">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {user?.role}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout from SliverUI"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-auto transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="h-full p-6">
          <Outlet />
        </div>

        {/* Status Legend */}
        <StatusLegend />

        {/* Help Button (mobile/collapsed sidebar) */}
        {!sidebarOpen && (
          <HelpButton onClick={() => setShowHelp(true)} />
        )}
      </main>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Pending Key Indicator */}
      <PendingKeyIndicator pendingKey={pendingKey} />
    </div>
  )
}
