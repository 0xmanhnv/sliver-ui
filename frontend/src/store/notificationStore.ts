import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  id: string
  type: 'session' | 'beacon' | 'listener' | 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  data?: any
}

interface NotificationSettings {
  soundEnabled: boolean
  desktopEnabled: boolean
  showNewSessions: boolean
  showNewBeacons: boolean
  showListenerEvents: boolean
}

interface NotificationState {
  notifications: Notification[]
  settings: NotificationSettings
  unreadCount: number

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
  updateSettings: (settings: Partial<NotificationSettings>) => void
}

// Play notification sound
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {
      // Ignore if autoplay is blocked
    })
  } catch {
    // Fallback: use Web Audio API for a simple beep
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch {
      // Audio not supported
    }
  }
}

// Show desktop notification
const showDesktopNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'sliver-notification',
    })
  }
}

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      settings: {
        soundEnabled: true,
        desktopEnabled: false,
        showNewSessions: true,
        showNewBeacons: true,
        showListenerEvents: true,
      },
      unreadCount: 0,

      addNotification: (notification) => {
        const { settings, notifications } = get()
        const newNotification: Notification = {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        }

        // Check if we should show this notification based on settings
        if (notification.type === 'session' && !settings.showNewSessions) return
        if (notification.type === 'beacon' && !settings.showNewBeacons) return
        if (notification.type === 'listener' && !settings.showListenerEvents) return

        // Add notification
        set({
          notifications: [newNotification, ...notifications].slice(0, 100), // Keep last 100
          unreadCount: get().unreadCount + 1,
        })

        // Play sound if enabled
        if (settings.soundEnabled) {
          playNotificationSound()
        }

        // Show desktop notification if enabled
        if (settings.desktopEnabled) {
          showDesktopNotification(notification.title, notification.message)
        }
      },

      markAsRead: (id) => {
        const { notifications } = get()
        const notification = notifications.find((n) => n.id === id)
        if (notification && !notification.read) {
          set({
            notifications: notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, get().unreadCount - 1),
          })
        }
      },

      markAllAsRead: () => {
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })
      },

      clearNotification: (id) => {
        const { notifications } = get()
        const notification = notifications.find((n) => n.id === id)
        set({
          notifications: notifications.filter((n) => n.id !== id),
          unreadCount: notification && !notification.read
            ? Math.max(0, get().unreadCount - 1)
            : get().unreadCount,
        })
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 })
      },

      updateSettings: (newSettings) => {
        set({
          settings: { ...get().settings, ...newSettings },
        })
      },
    }),
    {
      name: 'sliver-notifications',
      partialize: (state) => ({
        settings: state.settings,
        // Don't persist notifications themselves
      }),
    }
  )
)
