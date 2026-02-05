import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Info, X } from 'lucide-react'

interface StatusItem {
  color: string
  label: string
  description: string
}

const statusItems: StatusItem[] = [
  {
    color: 'bg-green-500',
    label: 'Active / Success',
    description: 'Session connected, beacon active, command succeeded',
  },
  {
    color: 'bg-blue-500',
    label: 'Processing',
    description: 'Beacon, command pending or executing',
  },
  {
    color: 'bg-yellow-500',
    label: 'Warning / Pending',
    description: 'Beacon overdue check-in, task pending',
  },
  {
    color: 'bg-red-500',
    label: 'Error / Danger',
    description: 'Disconnected, command failed, or delete/kill button',
  },
  {
    color: 'bg-purple-500',
    label: 'File / Upload',
    description: 'Related to file operations: download, upload',
  },
  {
    color: 'bg-gray-500',
    label: 'Inactive',
    description: 'Disabled, no data, or default state',
  },
]

const iconLegend = [
  { icon: '🪟', label: 'Windows' },
  { icon: '🐧', label: 'Linux' },
  { icon: '🍎', label: 'macOS' },
  { icon: '💻', label: 'Other OS' },
]

export function StatusLegend() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating button - fixed position bottom-right, less intrusive */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[90] shadow-lg bg-background/95 backdrop-blur-sm hover:bg-accent"
        title="Color Legend"
      >
        <Info className="h-4 w-4" />
        <span className="sr-only">Color Legend</span>
      </Button>

      {/* Popup panel */}
      {isOpen && (
        <div className="fixed bottom-14 right-4 z-[100] w-80 bg-card border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <h3 className="font-medium">Color Legend</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Status colors */}
      <div className="p-4 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Status
        </h4>
        {statusItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className={cn('w-3 h-3 rounded-full mt-1 flex-shrink-0', item.color)} />
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* OS Icons */}
      <div className="p-4 border-t">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Operating System
        </h4>
        <div className="flex flex-wrap gap-4">
          {iconLegend.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Connection indicator */}
      <div className="p-4 border-t">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Server Connection
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm">Connected (WebSocket active)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm">Disconnected (reconnecting)</span>
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  )
}

// Inline status badge with tooltip
export function StatusBadge({
  status,
  size = 'default',
}: {
  status: 'active' | 'pending' | 'warning' | 'error' | 'disabled'
  size?: 'small' | 'default'
}) {
  const colors = {
    active: 'bg-green-500',
    pending: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    disabled: 'bg-gray-500',
  }

  const labels = {
    active: 'Active',
    pending: 'Processing',
    warning: 'Warning',
    error: 'Error',
    disabled: 'Inactive',
  }

  return (
    <div className="flex items-center gap-2" title={labels[status]}>
      <div
        className={cn(
          'rounded-full',
          colors[status],
          size === 'small' ? 'w-2 h-2' : 'w-3 h-3'
        )}
      />
    </div>
  )
}
