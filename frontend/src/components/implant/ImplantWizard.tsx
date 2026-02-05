import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { implantsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Monitor,
  Radio,
  Wifi,
  Shield,
  Package,
  Download,
  Loader2,
  Info,
  Zap,
  Clock,
} from 'lucide-react'

type Step = 'type' | 'os' | 'connection' | 'options' | 'generate'

interface WizardData {
  implantType: 'session' | 'beacon'
  os: 'windows' | 'linux' | 'darwin'
  arch: 'amd64' | '386'
  c2Host: string
  c2Port: string
  protocol: 'mtls' | 'https' | 'http' | 'dns'
  format: 'exe' | 'shared' | 'shellcode'
  name: string
  interval: number
  jitter: number
}

const defaultData: WizardData = {
  implantType: 'session',
  os: 'windows',
  arch: 'amd64',
  c2Host: '',
  c2Port: '8888',
  protocol: 'mtls',
  format: 'exe',
  name: '',
  interval: 60,
  jitter: 30,
}

interface ImplantWizardProps {
  onComplete: () => void
  onCancel: () => void
}

export function ImplantWizard({ onComplete, onCancel }: ImplantWizardProps) {
  const [step, setStep] = useState<Step>('type')
  const [data, setData] = useState<WizardData>(defaultData)
  const { toast } = useToast()

  const generateMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: data.name || `implant-${Date.now()}`,
        os: data.os,
        arch: data.arch,
        format: data.format,
        is_beacon: data.implantType === 'beacon',
        c2_urls: [`${data.protocol}://${data.c2Host}:${data.c2Port}`],
      }

      if (data.implantType === 'beacon') {
        payload.beacon_interval = data.interval
        payload.beacon_jitter = data.jitter
      }

      return implantsApi.generate(payload)
    },
    onSuccess: (response) => {
      toast({ title: 'Implant generated successfully!' })
      if (response.download_url) {
        window.location.href = response.download_url
      }
      onComplete()
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to generate implant',
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const steps: { id: Step; label: string }[] = [
    { id: 'type', label: 'Implant Type' },
    { id: 'os', label: 'Operating System' },
    { id: 'connection', label: 'Connection' },
    { id: 'options', label: 'Options' },
    { id: 'generate', label: 'Generate' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === step)

  const canGoNext = () => {
    switch (step) {
      case 'type':
        return true
      case 'os':
        return true
      case 'connection':
        return data.c2Host.length > 0 && data.c2Port.length > 0
      case 'options':
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].id)
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Wizard */}
      <div className="relative w-full max-w-2xl bg-card rounded-xl shadow-2xl border overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Progress */}
        <div className="flex border-b">
          {steps.map((s, index) => (
            <div
              key={s.id}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium',
                index <= currentStepIndex
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                    ? 'border-2 border-primary'
                    : 'border-2 border-muted'
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Type */}
          {step === 'type' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Choose Implant Type</h2>
                <p className="text-muted-foreground mt-1">
                  Session for real-time interaction, Beacon for stealth operations
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setData({ ...data, implantType: 'session' })}
                  className={cn(
                    'p-6 rounded-xl border-2 text-left transition-all',
                    data.implantType === 'session'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                >
                  <Monitor className="h-10 w-10 text-green-500 mb-4" />
                  <h3 className="text-lg font-bold">Session</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Direct real-time connection. Commands execute immediately.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span>Fast response</span>
                  </div>
                </button>

                <button
                  onClick={() => setData({ ...data, implantType: 'beacon' })}
                  className={cn(
                    'p-6 rounded-xl border-2 text-left transition-all',
                    data.implantType === 'beacon'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                >
                  <Radio className="h-10 w-10 text-blue-500 mb-4" />
                  <h3 className="text-lg font-bold">Beacon</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Periodic check-in. Less traffic, harder to detect.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Stealth operations</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: OS */}
          {step === 'os' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Select Target Operating System</h2>
                <p className="text-muted-foreground mt-1">
                  The implant will be compiled for this OS
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { id: 'windows', icon: '🪟', name: 'Windows' },
                  { id: 'linux', icon: '🐧', name: 'Linux' },
                  { id: 'darwin', icon: '🍎', name: 'macOS' },
                ].map((os) => (
                  <button
                    key={os.id}
                    onClick={() => setData({ ...data, os: os.id as any })}
                    className={cn(
                      'p-6 rounded-xl border-2 text-center transition-all',
                      data.os === os.id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground'
                    )}
                  >
                    <span className="text-4xl">{os.icon}</span>
                    <h3 className="font-bold mt-3">{os.name}</h3>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium mb-2 block">CPU Architecture</label>
                <div className="flex gap-4">
                  {[
                    { id: 'amd64', name: '64-bit (x64)', desc: 'Most common' },
                    { id: '386', name: '32-bit (x86)', desc: 'Older machines' },
                  ].map((arch) => (
                    <button
                      key={arch.id}
                      onClick={() => setData({ ...data, arch: arch.id as any })}
                      className={cn(
                        'flex-1 p-4 rounded-lg border-2 text-left transition-all',
                        data.arch === arch.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground'
                      )}
                    >
                      <span className="font-medium">{arch.name}</span>
                      <p className="text-xs text-muted-foreground">{arch.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Connection */}
          {step === 'connection' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Configure Connection</h2>
                <p className="text-muted-foreground mt-1">
                  Enter your C2 server address and connection protocol
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Connection Protocol
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { id: 'mtls', name: 'mTLS', desc: 'High security, custom port', recommended: true },
                      { id: 'https', name: 'HTTPS', desc: 'Web traffic disguise, port 443' },
                      { id: 'http', name: 'HTTP', desc: 'No encryption (testing only)' },
                      { id: 'dns', name: 'DNS', desc: 'Via DNS, very slow' },
                    ].map((proto) => (
                      <button
                        key={proto.id}
                        onClick={() => setData({ ...data, protocol: proto.id as any })}
                        className={cn(
                          'p-4 rounded-lg border-2 text-left transition-all',
                          data.protocol === proto.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{proto.name}</span>
                          {proto.recommended && (
                            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{proto.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      C2 Server Host/IP *
                    </label>
                    <Input
                      placeholder="192.168.1.100 or c2.example.com"
                      value={data.c2Host}
                      onChange={(e) => setData({ ...data, c2Host: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Address the implant will connect to
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Port *</label>
                    <Input
                      placeholder="8888"
                      value={data.c2Port}
                      onChange={(e) => setData({ ...data, c2Port: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Port of your running listener
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-600 dark:text-blue-400">
                        Important Note
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Host and port must match a running Listener. If you don't have one yet,
                        create a Listener first on the Listeners page.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Options */}
          {step === 'options' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Additional Options</h2>
                <p className="text-muted-foreground mt-1">
                  Configure output format and other settings
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Implant Name (optional)</label>
                  <Input
                    placeholder="my-implant"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Output Format</label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { id: 'exe', name: 'Executable', desc: '.exe (Win) / ELF (Linux)' },
                      { id: 'shared', name: 'Shared Library', desc: '.dll / .so / .dylib' },
                      { id: 'shellcode', name: 'Shellcode', desc: 'Raw bytes' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setData({ ...data, format: fmt.id as any })}
                        className={cn(
                          'p-4 rounded-lg border-2 text-left transition-all',
                          data.format === fmt.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground'
                        )}
                      >
                        <span className="font-medium">{fmt.name}</span>
                        <p className="text-xs text-muted-foreground mt-1">{fmt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {data.implantType === 'beacon' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Interval (seconds)
                      </label>
                      <Input
                        type="number"
                        value={data.interval}
                        onChange={(e) => setData({ ...data, interval: parseInt(e.target.value) || 60 })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Time between check-ins
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Jitter (%)
                      </label>
                      <Input
                        type="number"
                        value={data.jitter}
                        onChange={(e) => setData({ ...data, jitter: parseInt(e.target.value) || 30 })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Random variation (0-100)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Generate */}
          {step === 'generate' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Review and Generate</h2>
                <p className="text-muted-foreground mt-1">
                  Verify your configuration before generating
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <SummaryRow label="Type" value={data.implantType === 'session' ? 'Session' : 'Beacon'} />
                <SummaryRow label="Operating System" value={`${data.os} (${data.arch})`} />
                <SummaryRow label="Connection" value={`${data.protocol}://${data.c2Host}:${data.c2Port}`} />
                <SummaryRow label="Format" value={data.format} />
                {data.name && <SummaryRow label="Name" value={data.name} />}
                {data.implantType === 'beacon' && (
                  <>
                    <SummaryRow label="Interval" value={`${data.interval}s`} />
                    <SummaryRow label="Jitter" value={`${data.jitter}%`} />
                  </>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating implant...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Generate and Download Implant
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between p-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? onCancel : goBack}
          >
            {currentStepIndex === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>

          {step !== 'generate' && (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
