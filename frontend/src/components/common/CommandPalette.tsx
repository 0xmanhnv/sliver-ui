import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Terminal,
  Search,
  X,
  User,
  Network,
  HardDrive,
  Cpu,
  FileText,
  Info,
  Clock,
  Shield,
  Eye,
} from 'lucide-react'

interface Command {
  id: string
  name: string
  description: string
  command: string
  icon: React.ElementType
  category: 'info' | 'network' | 'files' | 'process' | 'system'
  os?: 'windows' | 'linux' | 'all'
}

const commonCommands: Command[] = [
  // Info commands
  {
    id: 'whoami',
    name: 'Current User',
    description: 'Display the username running the implant',
    command: 'whoami',
    icon: User,
    category: 'info',
    os: 'all',
  },
  {
    id: 'hostname',
    name: 'Hostname',
    description: 'Display the machine hostname',
    command: 'hostname',
    icon: Info,
    category: 'info',
    os: 'all',
  },
  {
    id: 'pwd',
    name: 'Current Directory',
    description: 'Display current working directory path',
    command: 'pwd',
    icon: HardDrive,
    category: 'info',
    os: 'linux',
  },
  {
    id: 'cd',
    name: 'Current Directory (Windows)',
    description: 'Display current working directory path',
    command: 'cd',
    icon: HardDrive,
    category: 'info',
    os: 'windows',
  },

  // Network commands
  {
    id: 'ifconfig',
    name: 'Network Config (Linux/Mac)',
    description: 'Display network configuration',
    command: 'ifconfig',
    icon: Network,
    category: 'network',
    os: 'linux',
  },
  {
    id: 'ipconfig',
    name: 'Network Config (Windows)',
    description: 'Display network configuration',
    command: 'ipconfig',
    icon: Network,
    category: 'network',
    os: 'windows',
  },
  {
    id: 'netstat',
    name: 'Network Connections',
    description: 'List active network connections',
    command: 'netstat -an',
    icon: Network,
    category: 'network',
    os: 'all',
  },
  {
    id: 'arp',
    name: 'ARP Table',
    description: 'View ARP table (devices on LAN)',
    command: 'arp -a',
    icon: Network,
    category: 'network',
    os: 'all',
  },

  // File commands
  {
    id: 'ls',
    name: 'List Files (Linux)',
    description: 'List files in current directory',
    command: 'ls -la',
    icon: FileText,
    category: 'files',
    os: 'linux',
  },
  {
    id: 'dir',
    name: 'List Files (Windows)',
    description: 'List files in current directory',
    command: 'dir',
    icon: FileText,
    category: 'files',
    os: 'windows',
  },

  // Process commands
  {
    id: 'ps',
    name: 'List Processes (Linux)',
    description: 'Display running processes',
    command: 'ps aux',
    icon: Cpu,
    category: 'process',
    os: 'linux',
  },
  {
    id: 'tasklist',
    name: 'List Processes (Windows)',
    description: 'Display running processes',
    command: 'tasklist',
    icon: Cpu,
    category: 'process',
    os: 'windows',
  },

  // System commands
  {
    id: 'uname',
    name: 'System Info (Linux)',
    description: 'Display kernel and OS information',
    command: 'uname -a',
    icon: Shield,
    category: 'system',
    os: 'linux',
  },
  {
    id: 'systeminfo',
    name: 'System Info (Windows)',
    description: 'Display detailed system information',
    command: 'systeminfo',
    icon: Shield,
    category: 'system',
    os: 'windows',
  },
  {
    id: 'env',
    name: 'Environment Variables',
    description: 'Display environment variables',
    command: 'env',
    icon: Eye,
    category: 'system',
    os: 'linux',
  },
  {
    id: 'set',
    name: 'Environment Variables (Windows)',
    description: 'Display environment variables',
    command: 'set',
    icon: Eye,
    category: 'system',
    os: 'windows',
  },
]

const categories = [
  { id: 'all', name: 'All', icon: Terminal },
  { id: 'info', name: 'Info', icon: Info },
  { id: 'network', name: 'Network', icon: Network },
  { id: 'files', name: 'Files', icon: FileText },
  { id: 'process', name: 'Process', icon: Cpu },
  { id: 'system', name: 'System', icon: Shield },
]

interface CommandPaletteProps {
  os?: string
  onSelectCommand: (command: string) => void
  onClose: () => void
}

export function CommandPalette({ os, onSelectCommand, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const osType = os?.toLowerCase().includes('windows') ? 'windows' : 'linux'

  const filteredCommands = commonCommands.filter((cmd) => {
    if (cmd.os !== 'all' && cmd.os !== osType) return false
    if (activeCategory !== 'all' && cmd.category !== activeCategory) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        cmd.name.toLowerCase().includes(searchLower) ||
        cmd.description.toLowerCase().includes(searchLower) ||
        cmd.command.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-xl shadow-2xl border overflow-hidden animate-in slide-in-from-top-4 fade-in duration-200">
        {/* Search header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 p-0 h-auto text-lg"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Categories */}
        <div className="flex gap-1 p-2 border-b overflow-x-auto">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0"
            >
              <cat.icon className="h-4 w-4 mr-1" />
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Commands list */}
        <div className="max-h-96 overflow-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No matching commands found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    onSelectCommand(cmd.command)
                    onClose()
                  }}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <cmd.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cmd.name}</span>
                      <code className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {cmd.command}
                      </code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {cmd.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground text-center">
          Click a command to execute • OS: {osType === 'windows' ? 'Windows' : 'Linux/Mac'}
        </div>
      </div>
    </div>
  )
}

// Button to open command palette
export function CommandPaletteButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn('gap-2', className)}
    >
      <Terminal className="h-4 w-4" />
      Common Commands
      <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd>
    </Button>
  )
}
