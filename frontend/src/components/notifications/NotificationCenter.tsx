import { useState } from 'react'
import { useNotificationStore, requestNotificationPermission } from '@/store/notificationStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Bell,
  BellOff,
  X,
  Check,
  CheckCheck,
  Trash2,
  Monitor,
  Radio,
  Antenna,
  Info,
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  Settings,
  ExternalLink,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface NotificationCenterProps {
  onClose: () => void
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const [showSettings, setShowSettings] = useState(false)
  const {
    notifications,
    settings,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    updateSettings,
  } = useNotificationStore()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'session':
        return <Monitor className="h-4 w-4 text-green-500" />
      case 'beacon':
        return <Radio className="h-4 w-4 text-blue-500" />
      case 'listener':
        return <Antenna className="h-4 w-4 text-purple-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const handleEnableDesktop = async () => {
    await requestNotificationPermission()
    if ('Notification' in window && Notification.permission === 'granted') {
      updateSettings({ desktopEnabled: true })
    }
  }

  return (
    <div className="fixed top-16 right-4 w-96 max-h-[80vh] bg-card rounded-xl shadow-2xl border overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="p-4 border-b bg-muted/20 space-y-3">
          <h4 className="text-sm font-medium">Settings</h4>

          <label className="flex items-center justify-between">
            <span className="text-sm">Sound notifications</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            >
              {settings.soundEnabled ? (
                <Volume2 className="h-4 w-4 text-green-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Desktop notifications</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={settings.desktopEnabled ? () => updateSettings({ desktopEnabled: false }) : handleEnableDesktop}
            >
              {settings.desktopEnabled ? (
                <Bell className="h-4 w-4 text-green-500" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </label>

          <div className="pt-2 border-t space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showNewSessions}
                onChange={(e) => updateSettings({ showNewSessions: e.target.checked })}
                className="rounded"
              />
              New sessions
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showNewBeacons}
                onChange={(e) => updateSettings({ showNewBeacons: e.target.checked })}
                className="rounded"
              />
              New beacons
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.showListenerEvents}
                onChange={(e) => updateSettings({ showListenerEvents: e.target.checked })}
                className="rounded"
              />
              Listener events
            </label>
          </div>
        </div>
      )}

      {/* Actions */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}

      {/* Notifications list */}
      <div className="max-h-[50vh] overflow-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Bell className="h-12 w-12 mb-2 opacity-30" />
            <p>No notifications</p>
            <p className="text-xs mt-1">
              You'll see new sessions and beacons here
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'p-3 hover:bg-muted/50 transition-colors',
                  !notification.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(notification.timestamp.toString())}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => clearNotification(notification.id)}
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Notification bell button for the header
export function NotificationBell() {
  const [showCenter, setShowCenter] = useState(false)
  const { unreadCount } = useNotificationStore()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setShowCenter(!showCenter)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {showCenter && <NotificationCenter onClose={() => setShowCenter(false)} />}
    </>
  )
}
