import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Keyboard, X } from 'lucide-react'

const shortcuts = [
  { keys: ['g', 'd'], description: 'Go to Dashboard', action: '/dashboard' },
  { keys: ['g', 's'], description: 'Go to Sessions', action: '/sessions' },
  { keys: ['g', 'b'], description: 'Go to Beacons', action: '/beacons' },
  { keys: ['g', 'i'], description: 'Go to Implants', action: '/implants' },
  { keys: ['g', 'l'], description: 'Go to Listeners', action: '/listeners' },
  { keys: ['g', 't'], description: 'Go to Tools', action: '/armory' },
  { keys: ['g', 'c'], description: 'Go to Cleanup', action: '/cleanup' },
  { keys: ['?'], description: 'Show keyboard shortcuts', action: 'help' },
  { keys: ['Esc'], description: 'Close dialogs', action: 'escape' },
]

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Show help with ?
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Close with Escape
      if (e.key === 'Escape') {
        setShowHelp(false)
        setPendingKey(null)
        return
      }

      // Handle 'g' prefix for navigation
      if (pendingKey === 'g') {
        const shortcut = shortcuts.find(s => s.keys[0] === 'g' && s.keys[1] === e.key)
        if (shortcut && typeof shortcut.action === 'string' && shortcut.action.startsWith('/')) {
          e.preventDefault()
          navigate(shortcut.action)
        }
        setPendingKey(null)
        return
      }

      // Set pending key for 'g'
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        setPendingKey('g')
        // Clear after timeout
        setTimeout(() => setPendingKey(null), 1000)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, pendingKey])

  return { showHelp, setShowHelp, pendingKey }
}

export function KeyboardShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <Card
        className="w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle id="shortcuts-title" className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Navigation</h4>
              <div className="space-y-1">
                {shortcuts
                  .filter((s) => s.action.startsWith('/'))
                  .map((shortcut) => (
                    <div key={shortcut.description} className="flex items-center justify-between text-sm">
                      <span>{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, idx) => (
                          <kbd
                            key={idx}
                            className="px-2 py-1 bg-muted rounded text-xs font-mono"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">General</h4>
              <div className="space-y-1">
                {shortcuts
                  .filter((s) => !s.action.startsWith('/'))
                  .map((shortcut) => (
                    <div key={shortcut.description} className="flex items-center justify-between text-sm">
                      <span>{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, idx) => (
                          <kbd
                            key={idx}
                            className="px-2 py-1 bg-muted rounded text-xs font-mono"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">?</kbd> anytime to show this help
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Pending key indicator
export function PendingKeyIndicator({ pendingKey }: { pendingKey: string | null }) {
  if (!pendingKey) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-card border rounded-lg shadow-lg">
      <span className="text-sm">
        Press next key... <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono ml-1">{pendingKey}</kbd>
      </span>
    </div>
  )
}
