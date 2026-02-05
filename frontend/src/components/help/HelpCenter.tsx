import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  HelpCircle,
  Search,
  X,
  Book,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  Monitor,
  Radio,
  Package,
  Antenna,
  Terminal,
  FileText,
  Camera,
  Cpu,
  Shield,
  Clock,
} from 'lucide-react'

interface HelpArticle {
  id: string
  title: string
  content: string
  category: string
  icon: React.ElementType
}

const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: 'what-is-sliver',
    title: 'What is Sliver?',
    content: `Sliver is an open-source Command & Control (C2) framework used for red team operations and penetration testing.

**Main Components:**
- **Server**: The control server where you manage everything
- **Implant**: Software deployed on target machines
- **Listener**: Service that listens for implant connections

**SliverUI** helps you manage Sliver through a web interface instead of command line.`,
    category: 'getting-started',
    icon: Book,
  },
  {
    id: 'first-steps',
    title: 'How do I get started?',
    content: `**Basic Workflow:**

1. **Start a Listener**
   - Go to the Listeners page
   - Click "Start Listener"
   - Choose type (mTLS recommended)
   - Enter host and port

2. **Generate an Implant**
   - Go to the Implants page
   - Select target OS (Windows/Linux/Mac)
   - Configure C2 address (pointing to listener)
   - Click Generate

3. **Deploy the Implant**
   - Download the generated implant file
   - Run it on the target machine
   - Session/Beacon will appear automatically

4. **Interact**
   - Click on a session to open terminal
   - Run commands like whoami, ls, etc.`,
    category: 'getting-started',
    icon: Lightbulb,
  },

  // Sessions & Beacons
  {
    id: 'session-vs-beacon',
    title: 'Session vs Beacon - What\'s the difference?',
    content: `**Session (Direct Connection)**
- Real-time, continuous connection
- Commands execute immediately
- Uses more bandwidth
- Easier to detect
- Best for: Quick interaction needed

**Beacon (Periodic Connection)**
- Checks in periodically (e.g., every 60 seconds)
- Commands are queued and execute on check-in
- Less traffic, harder to detect
- Can add jitter (random variation)
- Best for: Long-term operations, stealth

**When to use what?**
- Need quick response → Session
- Need stealth, long-term access → Beacon`,
    category: 'concepts',
    icon: Monitor,
  },
  {
    id: 'beacon-interval',
    title: 'What are Interval and Jitter?',
    content: `**Interval**
Time between beacon check-ins with the server.
- Interval = 60s → Beacon calls home every 60 seconds
- Short interval = faster response but more traffic
- Long interval = less traffic but slower response

**Jitter**
Random variation in the interval timing.
- Jitter = 20% with interval 60s
- Actual check-in varies from 48s to 72s
- Makes traffic patterns look more natural

**Recommendations:**
- Testing environment: interval 10-30s, jitter 10%
- Production: interval 300-600s, jitter 30-50%`,
    category: 'concepts',
    icon: Clock,
  },

  // Listeners
  {
    id: 'listener-types',
    title: 'Listener Types Explained',
    content: `**mTLS (Mutual TLS)**
- Highest security
- Both sides authenticate with certificates
- Custom port (default: 8888)
- ✅ Recommended for internal environments

**HTTPS**
- Disguised as normal HTTPS traffic
- Port 443 (default)
- Can go through proxies
- ✅ Recommended for firewall environments

**HTTP**
- No encryption
- Only use for testing
- ⚠️ Don't use in production

**DNS**
- Tunnels through DNS queries
- Extremely slow but very hard to block
- Requires a domain you control
- ✅ Use when all ports are blocked`,
    category: 'listeners',
    icon: Antenna,
  },

  // Implants
  {
    id: 'implant-formats',
    title: 'Implant Formats Explained',
    content: `**Executable (.exe, ELF)**
- Standalone executable file
- Easiest to use
- Easier for AV to detect

**Shared Library (.dll, .so)**
- Needs to be loaded into another process
- Harder to detect
- Used for DLL injection, etc.

**Shellcode**
- Raw bytes, no headers
- Needs a wrapper to execute
- Most flexible

**Stager vs Stageless**
- Stageless: Complete payload, larger file (~10MB)
- Stager: Small payload downloads main payload, smaller file (~100KB)`,
    category: 'implants',
    icon: Package,
  },

  // Features
  {
    id: 'terminal-usage',
    title: 'Using the Terminal',
    content: `**Built-in Commands:**
- \`clear\` - Clear the screen
- \`history\` - View command history
- \`help\` - Show help

**Keyboard Shortcuts:**
- ↑/↓ - Navigate command history
- Ctrl+C - Cancel current input
- Ctrl+L - Clear screen
- Ctrl+K - Open command palette

**Tips:**
- Click "Common Commands" button to see frequently used commands
- Output can be copied or downloaded`,
    category: 'features',
    icon: Terminal,
  },
  {
    id: 'file-browser',
    title: 'File Browser',
    content: `**Features:**
- Browse directories like a file explorer
- Download files to your local machine
- View file sizes and modification dates

**Actions:**
- Click folder to open
- Click breadcrumb to go back
- Click Download icon to download file

**Note:**
- Large files may take time
- Some system directories may require elevated privileges`,
    category: 'features',
    icon: FileText,
  },
  {
    id: 'screenshots',
    title: 'Taking Screenshots',
    content: `**How to use:**
1. Go to Screenshots tab in Session
2. Click "Capture Screenshot"
3. Wait a few seconds for the image
4. Image is saved to gallery below

**Features:**
- View fullscreen
- Download to machine
- Gallery stores all captured images

**Note:**
- Each capture sends ~1-5MB of data
- Region/monitor selection not supported`,
    category: 'features',
    icon: Camera,
  },
  {
    id: 'process-list',
    title: 'Process Management',
    content: `**Features:**
- View all running processes
- Search by name, PID, or user
- Kill processes (except implant)

**Information Displayed:**
- PID - Process ID
- PPID - Parent Process ID
- Executable - Program name/path
- Owner - User running the process
- Architecture - x64 or x86

**IMPLANT tagged process:**
This is the implant's process - don't kill it!`,
    category: 'features',
    icon: Cpu,
  },
]

const categories = [
  { id: 'all', name: 'All' },
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'concepts', name: 'Concepts' },
  { id: 'listeners', name: 'Listeners' },
  { id: 'implants', name: 'Implants' },
  { id: 'features', name: 'Features' },
]

interface HelpCenterProps {
  onClose: () => void
}

export function HelpCenter({ onClose }: HelpCenterProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null)

  const filteredArticles = helpArticles.filter((article) => {
    if (activeCategory !== 'all' && article.category !== activeCategory) return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        article.title.toLowerCase().includes(searchLower) ||
        article.content.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[80vh] bg-card rounded-xl shadow-2xl border overflow-hidden flex animate-in zoom-in-95 fade-in duration-200">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col bg-muted/30">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-6 w-6 text-primary" />
              <h2 className="text-lg font-bold">Help Center</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-2 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id)
                  setSelectedArticle(null)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Quick links */}
          <div className="mt-auto p-4 border-t space-y-2">
            <a
              href="https://github.com/BishopFox/sliver/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Sliver Wiki
            </a>
            <a
              href="https://sliver.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Sliver Official
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium">
              {selectedArticle ? selectedArticle.title : 'Select an article'}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Article content or list */}
          <div className="flex-1 overflow-auto">
            {selectedArticle ? (
              <div className="p-6">
                {/* Back button */}
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  ← Back to list
                </button>

                {/* Article icon and title */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <selectedArticle.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">{selectedArticle.title}</h2>
                </div>

                {/* Article content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedArticle.content.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return (
                        <h4 key={i} className="font-bold mt-4 mb-2">
                          {line.replace(/\*\*/g, '')}
                        </h4>
                      )
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <li key={i} className="ml-4">
                          {line.substring(2)}
                        </li>
                      )
                    }
                    if (line.match(/^\d+\./)) {
                      return (
                        <li key={i} className="ml-4 list-decimal">
                          {line.replace(/^\d+\.\s*/, '')}
                        </li>
                      )
                    }
                    if (line.startsWith('✅') || line.startsWith('⚠️')) {
                      return (
                        <p key={i} className="my-1">
                          {line}
                        </p>
                      )
                    }
                    if (line.trim() === '') {
                      return <br key={i} />
                    }
                    return (
                      <p key={i} className="my-2">
                        {line}
                      </p>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No articles found matching your search
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredArticles.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => setSelectedArticle(article)}
                        className="w-full flex items-center gap-3 p-4 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          <article.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{article.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {article.content.substring(0, 100)}...
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Floating help button
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 z-40"
      title="Help"
    >
      <HelpCircle className="h-6 w-6" />
    </button>
  )
}
