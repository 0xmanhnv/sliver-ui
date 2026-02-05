import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useMutation } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, Trash2, Copy, Download, Terminal as TerminalIcon } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { CommandPalette, CommandPaletteButton } from '@/components/common/CommandPalette'
import 'xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
  sessionName?: string
  os?: string
}

export function Terminal({ sessionId, sessionName, os }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const inputBufferRef = useRef('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [outputBuffer, setOutputBuffer] = useState<string[]>([])
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const { toast } = useToast()

  // Shell execution mutation
  const shellMutation = useMutation({
    mutationFn: ({ command }: { command: string }) =>
      sessionsApi.shell(sessionId, command),
    onSuccess: (data) => {
      const xterm = xtermRef.current
      if (!xterm) return

      // Write output
      if (data.output) {
        const lines = data.output.split('\n')
        lines.forEach((line: string) => {
          xterm.writeln(line)
          setOutputBuffer((prev) => [...prev, line])
        })
      }
      if (data.stderr) {
        xterm.writeln(`\x1b[31m${data.stderr}\x1b[0m`) // Red for stderr
      }

      // Write new prompt
      writePrompt()
    },
    onError: (error: any) => {
      const xterm = xtermRef.current
      if (xterm) {
        xterm.writeln(`\x1b[31mError: ${error.message || 'Command failed'}\x1b[0m`)
        writePrompt()
      }
    },
  })

  // Get prompt based on OS
  const getPrompt = useCallback(() => {
    if (os?.toLowerCase() === 'windows') {
      return `\x1b[36m${sessionName || 'session'}>\x1b[0m `
    }
    return `\x1b[32m${sessionName || 'session'}\x1b[0m:\x1b[34m~\x1b[0m$ `
  }, [os, sessionName])

  const writePrompt = useCallback(() => {
    const xterm = xtermRef.current
    if (xterm) {
      xterm.write('\r\n' + getPrompt())
    }
  }, [getPrompt])

  // Execute command from command palette
  const executeCommand = useCallback((command: string) => {
    const xterm = xtermRef.current
    if (!xterm) return

    // Show command in terminal
    xterm.write(command + '\r\n')

    // Add to history
    setCommandHistory((prev) => {
      const newHistory = [...prev.filter((c) => c !== command), command]
      return newHistory.slice(-100)
    })
    setHistoryIndex(-1)

    // Execute
    shellMutation.mutate({ command })
  }, [shellMutation])

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    // Welcome message
    xterm.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════╗')
    xterm.writeln('║           SliverUI Interactive Terminal                ║')
    xterm.writeln('╚════════════════════════════════════════════════════════╝\x1b[0m')
    xterm.writeln('')
    xterm.writeln(`\x1b[33mSession:\x1b[0m ${sessionName || sessionId}`)
    xterm.writeln(`\x1b[33mOS:\x1b[0m ${os || 'unknown'}`)
    xterm.writeln('')
    xterm.writeln('\x1b[90mType a command and press Enter to execute.\x1b[0m')
    xterm.writeln('\x1b[90mUse ↑/↓ to navigate command history.\x1b[0m')
    xterm.writeln('\x1b[90mPress Ctrl+K to open the command palette.\x1b[0m')
    xterm.writeln('')
    xterm.write(getPrompt())

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Handle key input
    xterm.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (domEvent.key === 'Enter') {
        // Execute command
        const command = inputBufferRef.current.trim()
        xterm.write('\r\n')

        if (command) {
          // Add to history
          setCommandHistory((prev) => {
            const newHistory = [...prev.filter((c) => c !== command), command]
            return newHistory.slice(-100)
          })
          setHistoryIndex(-1)

          // Handle built-in commands
          if (command === 'clear') {
            xterm.clear()
            xterm.write(getPrompt())
          } else if (command === 'history') {
            commandHistory.forEach((cmd, i) => {
              xterm.writeln(`  ${i + 1}  ${cmd}`)
            })
            xterm.write(getPrompt())
          } else if (command === 'help') {
            xterm.writeln('\x1b[1mAvailable Commands:\x1b[0m')
            xterm.writeln('  clear    - Clear the screen')
            xterm.writeln('  history  - View command history')
            xterm.writeln('  help     - Show this help')
            xterm.writeln('')
            xterm.writeln('\x1b[1mKeyboard Shortcuts:\x1b[0m')
            xterm.writeln('  Ctrl+K   - Open command palette')
            xterm.writeln('  Ctrl+L   - Clear screen')
            xterm.writeln('  Ctrl+C   - Cancel current input')
            xterm.writeln('')
            xterm.writeln('\x1b[90mOther commands will be sent to the session.\x1b[0m')
            xterm.write(getPrompt())
          } else {
            // Send to session
            shellMutation.mutate({ command })
          }
        } else {
          xterm.write(getPrompt())
        }

        inputBufferRef.current = ''
      } else if (domEvent.key === 'Backspace') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          xterm.write('\b \b')
        }
      } else if (domEvent.key === 'ArrowUp') {
        // Navigate history up
        const history = commandHistory
        if (history.length > 0) {
          const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
          setHistoryIndex(newIndex)
          const cmd = history[newIndex]

          // Clear current input
          while (inputBufferRef.current.length > 0) {
            xterm.write('\b \b')
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          }

          // Write history command
          inputBufferRef.current = cmd
          xterm.write(cmd)
        }
      } else if (domEvent.key === 'ArrowDown') {
        // Navigate history down
        const history = commandHistory
        if (historyIndex !== -1) {
          const newIndex = historyIndex >= history.length - 1 ? -1 : historyIndex + 1

          // Clear current input
          while (inputBufferRef.current.length > 0) {
            xterm.write('\b \b')
            inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          }

          if (newIndex === -1) {
            setHistoryIndex(-1)
          } else {
            setHistoryIndex(newIndex)
            const cmd = history[newIndex]
            inputBufferRef.current = cmd
            xterm.write(cmd)
          }
        }
      } else if (domEvent.ctrlKey && domEvent.key === 'c') {
        // Ctrl+C - cancel current input
        xterm.write('^C\r\n')
        inputBufferRef.current = ''
        xterm.write(getPrompt())
      } else if (domEvent.ctrlKey && domEvent.key === 'l') {
        // Ctrl+L - clear screen
        xterm.clear()
        xterm.write(getPrompt())
      } else if (domEvent.ctrlKey && domEvent.key === 'k') {
        // Ctrl+K - open command palette
        domEvent.preventDefault()
        setShowCommandPalette(true)
      } else if (printable) {
        inputBufferRef.current += key
        xterm.write(key)
      }
    })

    // Global keyboard shortcut for command palette
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKeydown)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleGlobalKeydown)
      xterm.dispose()
    }
  }, [sessionId, sessionName, os, getPrompt, commandHistory, historyIndex, shellMutation])

  // Copy output to clipboard
  const copyOutput = () => {
    const text = outputBuffer.join('\n')
    navigator.clipboard.writeText(text)
    toast({ title: 'Output copied to clipboard' })
  }

  // Download output
  const downloadOutput = () => {
    const text = outputBuffer.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terminal_${sessionName || sessionId}_${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Clear terminal
  const clearTerminal = () => {
    const xterm = xtermRef.current
    if (xterm) {
      xterm.clear()
      xterm.write(getPrompt())
    }
    setOutputBuffer([])
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      fitAddonRef.current?.fit()
    }, 100)
  }

  return (
    <div
      className={`flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'
      }`}
    >
      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          os={os}
          onSelectCommand={executeCommand}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-[#1a1b26]">
        <TerminalIcon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-400 font-mono">
          {sessionName || sessionId}
        </span>

        <div className="flex-1" />

        <CommandPaletteButton onClick={() => setShowCommandPalette(true)} />

        <div className="h-4 w-px bg-gray-700 mx-2" />

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyOutput} title="Copy output">
          <Copy className="h-4 w-4 text-gray-400" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadOutput} title="Download output">
          <Download className="h-4 w-4 text-gray-400" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearTerminal} title="Clear screen">
          <Trash2 className="h-4 w-4 text-gray-400" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen} title="Fullscreen">
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4 text-gray-400" />
          ) : (
            <Maximize2 className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2 bg-[#1a1b26]" />

      {/* Status bar */}
      <div className="flex items-center px-2 py-1 border-t bg-[#1a1b26] text-xs text-gray-500">
        <span>{shellMutation.isPending ? 'Executing...' : 'Ready'}</span>
        <div className="flex-1" />
        <span>History: {commandHistory.length} commands</span>
        <span className="mx-2">•</span>
        <span>Ctrl+K: Command Palette</span>
      </div>
    </div>
  )
}
