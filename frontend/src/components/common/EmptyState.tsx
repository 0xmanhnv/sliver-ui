import { LucideIcon, Inbox, Search, FileX, Users, Radio, Cpu, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Pre-configured empty states for common scenarios
export function NoSessionsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Terminal}
      title="No Active Sessions"
      description="Sessions will appear here when implants connect to your Sliver server."
      action={onAction ? { label: 'Generate Implant', onClick: onAction } : undefined}
    />
  )
}

export function NoBeaconsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Radio}
      title="No Active Beacons"
      description="Beacons will appear here when beacon implants check in."
      action={onAction ? { label: 'Generate Beacon', onClick: onAction } : undefined}
    />
  )
}

export function NoListenersEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Radio}
      title="No Active Listeners"
      description="Start a listener to accept incoming implant connections."
      action={onAction ? { label: 'Start Listener', onClick: onAction } : undefined}
    />
  )
}

export function NoProcessesEmpty() {
  return (
    <EmptyState
      icon={Cpu}
      title="No Processes Found"
      description="Process list is empty or could not be retrieved."
    />
  )
}

export function NoFilesEmpty() {
  return (
    <EmptyState
      icon={FileX}
      title="No Files"
      description="This directory is empty."
    />
  )
}

export function NoUsersEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No Users"
      description="Create a user to grant access to the system."
      action={onAction ? { label: 'Add User', onClick: onAction } : undefined}
    />
  )
}

export function NoResultsEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No Results Found"
      description={`No matches found for "${query}". Try adjusting your search terms.`}
    />
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon={FileX}
      title={title}
      description={description || 'An error occurred while loading data.'}
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
      className="text-destructive"
    />
  )
}
