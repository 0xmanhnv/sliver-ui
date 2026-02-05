import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: React.ReactNode
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  position = 'top',
  delay = 300,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-100 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-100 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-100 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-100 border-y-transparent border-l-transparent',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-sm rounded-lg shadow-lg',
            'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
            'whitespace-nowrap animate-in fade-in-0 zoom-in-95',
            positionClasses[position],
            className
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute border-4',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  )
}

// Technical term tooltips
export const TechTerms = {
  session: 'Direct real-time connection to the target. Commands execute immediately.',
  beacon: 'Periodic connection (check-in). Commands are queued and execute on next check-in.',
  implant: 'Software deployed on the target machine to establish a connection back to the server.',
  listener: 'Service listening on the server, waiting for connections from implants.',
  mtls: 'Mutual TLS - Two-way secure connection with certificates.',
  https: 'Connection over HTTPS, disguised as normal web traffic.',
  dns: 'Connection via DNS queries, difficult to detect by firewalls.',
  stager: 'Small payload that downloads the main payload. Used when initial file size matters.',
  stageless: 'Complete payload, no additional downloads. Larger file but simpler deployment.',
  pid: 'Process ID - Unique identifier for a running process.',
  arch: 'Architecture - CPU type: x64 (64-bit) or x86 (32-bit).',
  transport: 'Protocol for data transmission between implant and server.',
  c2: 'Command & Control - Server controlling the implants.',
  jitter: 'Random variation in check-in timing to avoid detection patterns.',
  interval: 'Time between beacon check-ins.',
}

// Helper component for technical terms
export function TechTerm({
  term,
  children,
}: {
  term: keyof typeof TechTerms
  children: React.ReactNode
}) {
  return (
    <Tooltip content={TechTerms[term]}>
      <span className="border-b border-dashed border-muted-foreground cursor-help">
        {children}
      </span>
    </Tooltip>
  )
}
