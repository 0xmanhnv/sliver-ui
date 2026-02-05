import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { implantsApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Tooltip, TechTerms } from '@/components/common/Tooltip'
import { ImplantWizard } from '@/components/implant/ImplantWizard'
import {
  Package,
  Download,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  Info,
  HelpCircle,
  Lightbulb,
} from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface C2Config {
  protocol: string
  host: string
  port: number
}

export function Implants() {
  const { toast } = useToast()
  const [showWizard, setShowWizard] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [os, setOs] = useState('windows')
  const [arch, setArch] = useState('amd64')
  const [format, setFormat] = useState('exe')
  const [beacon, setBeacon] = useState(false)
  const [interval, setInterval] = useState(60)
  const [jitter, setJitter] = useState(30)
  const [debug, setDebug] = useState(false)
  const [evasion, setEvasion] = useState(true)
  const [c2List, setC2List] = useState<C2Config[]>([
    { protocol: 'mtls', host: '', port: 443 },
  ])

  // Generated implant state
  const [generatedImplant, setGeneratedImplant] = useState<any>(null)

  const generateMutation = useMutation({
    mutationFn: () =>
      implantsApi.generate({
        name,
        os,
        arch,
        format,
        c2: c2List.filter((c) => c.host),
        beacon,
        interval,
        jitter,
        debug,
        evasion,
      }),
    onSuccess: (data) => {
      setGeneratedImplant(data)
      toast({ title: 'Implant generated successfully!' })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to generate implant',
        description: error.response?.data?.detail,
      })
    },
  })

  const addC2 = () => {
    setC2List([...c2List, { protocol: 'mtls', host: '', port: 443 }])
  }

  const removeC2 = (index: number) => {
    setC2List(c2List.filter((_, i) => i !== index))
  }

  const updateC2 = (index: number, field: keyof C2Config, value: string | number) => {
    const updated = [...c2List]
    updated[index] = { ...updated[index], [field]: value }
    setC2List(updated)
  }

  const handleDownload = async () => {
    if (!generatedImplant) return

    try {
      const blob = await implantsApi.download(
        generatedImplant.download_url.split('/').pop()
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = generatedImplant.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: error.message,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Wizard Modal */}
      {showWizard && (
        <ImplantWizard
          onComplete={() => setShowWizard(false)}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Implant Builder</h1>
          <p className="text-muted-foreground mt-1">
            Generate implants to deploy on target machines
          </p>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => setShowWizard(true)}
          className="p-6 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors">
              <Wand2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                Quick Generate with Wizard
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 rounded-full">
                  Recommended
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Step-by-step guide, ideal for beginners
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'p-6 rounded-xl border-2 text-left transition-colors',
            showAdvanced
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted">
              <Package className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Advanced Form</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Full options for experienced users
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Info box for beginners */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-600 dark:text-blue-400">
              What is an Implant?
            </p>
            <p className="text-muted-foreground mt-1">
              An implant is software installed on the target machine to create a reverse connection back to your server.
              Once the implant runs, you will have a Session or Beacon to interact with the target machine.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Form */}
      {showAdvanced && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Builder Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Implant Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Implant Name
                  <Tooltip content="Name to identify this implant. Leave empty to auto-generate.">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </label>
                <Input
                  placeholder="my-implant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* OS */}
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Target Operating System
                  <Tooltip content="Select the OS where the implant will run">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'windows', icon: '🪟', name: 'Windows' },
                    { id: 'linux', icon: '🐧', name: 'Linux' },
                    { id: 'darwin', icon: '🍎', name: 'macOS' },
                  ].map((o) => (
                    <Button
                      key={o.id}
                      size="sm"
                      variant={os === o.id ? 'default' : 'outline'}
                      onClick={() => setOs(o.id)}
                    >
                      <span className="mr-1">{o.icon}</span>
                      {o.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Architecture */}
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  CPU Architecture
                  <Tooltip content={TechTerms.arch}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'amd64', name: '64-bit' },
                    { id: '386', name: '32-bit' },
                  ].map((a) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant={arch === a.id ? 'default' : 'outline'}
                      onClick={() => setArch(a.id)}
                    >
                      {a.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Output Format
                  <Tooltip content="exe/ELF: Executable file. dll/so: Shared library. shellcode: Raw bytes">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'exe', name: 'Executable' },
                    { id: 'shared', name: 'Shared Lib' },
                    { id: 'shellcode', name: 'Shellcode' },
                  ].map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={format === f.id ? 'default' : 'outline'}
                      onClick={() => setFormat(f.id)}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  Connection Type
                  <Tooltip content={`Session: ${TechTerms.session} | Beacon: ${TechTerms.beacon}`}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </label>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant={!beacon ? 'default' : 'outline'}
                    onClick={() => setBeacon(false)}
                  >
                    Session (real-time)
                  </Button>
                  <Button
                    size="sm"
                    variant={beacon ? 'default' : 'outline'}
                    onClick={() => setBeacon(true)}
                  >
                    Beacon (periodic)
                  </Button>
                </div>
              </div>

              {/* Beacon options */}
              {beacon && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                      Interval
                      <Tooltip content={TechTerms.interval}>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Tooltip>
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(parseInt(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                      Jitter
                      <Tooltip content={TechTerms.jitter}>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Tooltip>
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={jitter}
                        onChange={(e) => setJitter(parseInt(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* C2 Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    C2 Configuration
                    <Tooltip content={TechTerms.c2}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </Tooltip>
                  </label>
                  <Button size="sm" variant="outline" onClick={addC2}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {c2List.map((c2, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={c2.protocol}
                      onChange={(e) => updateC2(index, 'protocol', e.target.value)}
                    >
                      <option value="mtls">mTLS</option>
                      <option value="https">HTTPS</option>
                      <option value="http">HTTP</option>
                      <option value="dns">DNS</option>
                    </select>
                    <Input
                      placeholder="host/IP"
                      value={c2.host}
                      onChange={(e) => updateC2(index, 'host', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="port"
                      className="w-24"
                      value={c2.port}
                      onChange={(e) => updateC2(index, 'port', parseInt(e.target.value))}
                    />
                    {c2List.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeC2(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-1">
                  Host and port must match a running Listener
                </p>
              </div>

              {/* Options */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={evasion}
                    onChange={(e) => setEvasion(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Evasion (AV bypass)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={debug}
                    onChange={(e) => setDebug(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Debug mode</span>
                </label>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !c2List[0]?.host}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating implant...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Generate Implant
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Implant */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Implant</CardTitle>
            </CardHeader>
            <CardContent>
              {generatedImplant ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Filename:</span>
                        <p className="font-medium">{generatedImplant.filename}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Size:</span>
                        <p className="font-medium">
                          {formatBytes(generatedImplant.size)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">OS/Arch:</span>
                        <p className="font-medium">
                          {generatedImplant.os}/{generatedImplant.arch}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Format:</span>
                        <p className="font-medium">{generatedImplant.format}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-muted-foreground text-sm">MD5:</span>
                      <p className="font-mono text-xs break-all">
                        {generatedImplant.md5}
                      </p>
                    </div>
                    <div className="mt-2">
                      <span className="text-muted-foreground text-sm">SHA256:</span>
                      <p className="font-mono text-xs break-all">
                        {generatedImplant.sha256}
                      </p>
                    </div>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Implant
                  </Button>

                  {/* Next steps */}
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                      Next Steps
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Download the implant file to your machine</li>
                      <li>Transfer the file to the target machine</li>
                      <li>Execute the file on the target machine</li>
                      <li>Check Sessions or Beacons to see the new connection</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    Configure and generate an implant to see details here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
