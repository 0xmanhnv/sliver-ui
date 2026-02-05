import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Cookie, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { browserOpsApi } from '@/services/api'
import { cn } from '@/lib/utils'

interface CookieExtractorProps {
  sessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onExtracted?: (cookies: any[]) => void
}

type Browser = 'chrome' | 'edge' | 'firefox'
type Method = 'sharp_chromium' | 'sharp_dpapi' | 'cookie_monster' | 'manual_shell'

const BROWSER_OPTIONS: { value: Browser; label: string }[] = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'edge', label: 'Edge' },
  { value: 'firefox', label: 'Firefox' },
]

const METHOD_OPTIONS: { value: Method; label: string; description: string }[] = [
  {
    value: 'sharp_chromium',
    label: 'SharpChromium',
    description: 'Chrome/Edge DPAPI decryption. Best for Chrome < 127.',
  },
  {
    value: 'sharp_dpapi',
    label: 'SharpDPAPI',
    description: 'DPAPI master key extraction. Needs elevated privileges.',
  },
  {
    value: 'cookie_monster',
    label: 'CookieMonster',
    description: 'BOF in-memory extraction. No disk writes.',
  },
  {
    value: 'manual_shell',
    label: 'Manual Shell',
    description: 'Copy cookie file for offline analysis. Most stealthy.',
  },
]

const selectStyles =
  'h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

export function CookieExtractor({ sessionId, onExtracted }: CookieExtractorProps) {
  const { toast } = useToast()

  const [browser, setBrowser] = useState<Browser>('chrome')
  const [method, setMethod] = useState<Method>('sharp_chromium')
  const [domainFilter, setDomainFilter] = useState('')
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [showRawOutput, setShowRawOutput] = useState(false)

  const selectedMethod = METHOD_OPTIONS.find((m) => m.value === method)

  const extractMutation = useMutation({
    mutationFn: () =>
      browserOpsApi.extractCookies({
        session_id: sessionId,
        browser,
        method,
        target_domain: domainFilter || undefined,
      }),
    onSuccess: (data) => {
      const cookies = data?.cookies ?? []
      const output = data?.raw_output ?? null

      if (output) {
        setRawOutput(typeof output === 'string' ? output : JSON.stringify(output, null, 2))
      }

      onExtracted?.(cookies)

      toast({
        title: 'Cookies extracted',
        description: `Retrieved ${cookies.length} cookie${cookies.length === 1 ? '' : 's'}${domainFilter ? ` for ${domainFilter}` : ''}.`,
      })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      const detail =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        error?.message ??
        'Unknown error occurred'

      toast({
        variant: 'destructive',
        title: 'Extraction failed',
        description: String(detail),
      })
    },
  })

  const handleExtract = () => {
    setRawOutput(null)
    setShowRawOutput(false)
    extractMutation.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cookie className="h-5 w-5" />
          Extract Cookies
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Selectors row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Browser selector */}
          <div className="space-y-1.5">
            <label htmlFor="cookie-browser" className="text-sm font-medium leading-none">
              Browser
            </label>
            <select
              id="cookie-browser"
              value={browser}
              onChange={(e) => setBrowser(e.target.value as Browser)}
              className={selectStyles}
            >
              {BROWSER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Method selector */}
          <div className="space-y-1.5">
            <label htmlFor="cookie-method" className="text-sm font-medium leading-none">
              Method
            </label>
            <select
              id="cookie-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={selectStyles}
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Method description */}
        {selectedMethod && (
          <p className="text-xs text-muted-foreground">{selectedMethod.description}</p>
        )}

        {/* Domain filter */}
        <div className="space-y-1.5">
          <label htmlFor="cookie-domain" className="text-sm font-medium leading-none">
            Domain filter
            <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="cookie-domain"
            type="text"
            placeholder="e.g. .example.com"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className={cn(
              'h-9 w-full rounded-md border bg-background px-3 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          />
        </div>

        {/* Extract button */}
        <Button
          onClick={handleExtract}
          disabled={extractMutation.isPending}
          className="w-full sm:w-auto"
        >
          {extractMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Cookie className="mr-2 h-4 w-4" />
              Extract
            </>
          )}
        </Button>

        {/* Raw output collapsible section */}
        {rawOutput && (
          <div className="rounded-md border">
            <button
              type="button"
              onClick={() => setShowRawOutput((prev) => !prev)}
              className={cn(
                'flex w-full items-center gap-2 px-4 py-2 text-sm font-medium',
                'hover:bg-muted/50 transition-colors',
                showRawOutput && 'border-b'
              )}
            >
              {showRawOutput ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Raw Output
            </button>

            {showRawOutput && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap p-4 text-xs text-muted-foreground">
                {rawOutput}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CookieExtractor
