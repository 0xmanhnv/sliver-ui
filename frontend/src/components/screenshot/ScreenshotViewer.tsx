import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Camera,
  Download,
  RefreshCw,
  Maximize2,
  X,
  Loader2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

interface Screenshot {
  id: string
  data: string // base64
  timestamp: Date
}

interface ScreenshotViewerProps {
  sessionId: string
  sessionName?: string
}

export function ScreenshotViewer({ sessionId, sessionName }: ScreenshotViewerProps) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { toast } = useToast()
  const accessToken = useAuthStore((state) => state.accessToken)

  // Take screenshot mutation
  const screenshotMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/sessions/${sessionId}/screenshot`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) throw new Error('Screenshot failed')
      const blob = await response.blob()
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    },
    onSuccess: (data) => {
      const newScreenshot: Screenshot = {
        id: Date.now().toString(),
        data,
        timestamp: new Date(),
      }
      setScreenshots((prev) => [newScreenshot, ...prev].slice(0, 10)) // Keep last 10
      setSelectedScreenshot(newScreenshot)
      toast({ title: 'Screenshot captured' })
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to capture screenshot' })
    },
  })

  // Download screenshot
  const downloadScreenshot = (screenshot: Screenshot) => {
    const link = document.createElement('a')
    link.href = screenshot.data
    link.download = `screenshot_${sessionName || sessionId}_${screenshot.timestamp.toISOString()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Auto refresh effect
  // useEffect(() => {
  //   if (!autoRefresh) return
  //   const interval = setInterval(() => {
  //     screenshotMutation.mutate()
  //   }, 5000)
  //   return () => clearInterval(interval)
  // }, [autoRefresh])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Button
          onClick={() => screenshotMutation.mutate()}
          disabled={screenshotMutation.isPending}
        >
          {screenshotMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          Capture
        </Button>

        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={cn('h-4 w-4 mr-1', autoRefresh && 'animate-spin')} />
          Auto (5s)
        </Button>

        {selectedScreenshot && (
          <>
            <div className="h-6 w-px bg-border mx-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadScreenshot(selectedScreenshot)}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              Fullscreen
            </Button>
          </>
        )}

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground">
          {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail sidebar */}
        <div className="w-32 border-r overflow-y-auto p-2 space-y-2">
          {screenshots.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-4">
              No screenshots yet
            </div>
          ) : (
            screenshots.map((ss) => (
              <button
                key={ss.id}
                onClick={() => setSelectedScreenshot(ss)}
                className={cn(
                  'w-full aspect-video rounded border overflow-hidden transition-all',
                  selectedScreenshot?.id === ss.id
                    ? 'ring-2 ring-primary'
                    : 'hover:ring-1 ring-border'
                )}
              >
                <img
                  src={ss.data}
                  alt="Screenshot thumbnail"
                  className="w-full h-full object-cover"
                />
              </button>
            ))
          )}
        </div>

        {/* Main viewer */}
        <div className="flex-1 flex items-center justify-center bg-black/50 p-4">
          {selectedScreenshot ? (
            <div className="relative max-w-full max-h-full">
              <img
                src={selectedScreenshot.data}
                alt="Screenshot"
                className="max-w-full max-h-[calc(100vh-300px)] object-contain rounded shadow-lg"
              />
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedScreenshot.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Camera className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>Click "Capture" to take a screenshot</p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedScreenshot.data}
            alt="Screenshot fullscreen"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  )
}
