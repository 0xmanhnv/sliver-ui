import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme, isDark } = useTheme()

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn('h-9 w-9', className)}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>
    )
  }

  return (
    <div className={cn('flex items-center gap-1 p-1 rounded-lg bg-muted', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme('light')}
        className={cn(
          'h-8 px-3',
          theme === 'light' && 'bg-background shadow-sm'
        )}
      >
        <Sun className="h-4 w-4 mr-1" />
        Light
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme('dark')}
        className={cn(
          'h-8 px-3',
          theme === 'dark' && 'bg-background shadow-sm'
        )}
      >
        <Moon className="h-4 w-4 mr-1" />
        Dark
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme('system')}
        className={cn(
          'h-8 px-3',
          theme === 'system' && 'bg-background shadow-sm'
        )}
      >
        <Monitor className="h-4 w-4 mr-1" />
        System
      </Button>
    </div>
  )
}
