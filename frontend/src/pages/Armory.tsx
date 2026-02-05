import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { armoryApi } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Package,
  Download,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface ArmoryPackage {
  name: string
  command_name: string
  version: string
  installed: boolean
  type: string
  repo_url: string
}

// Tool descriptions for better UX
const toolDescriptions: Record<string, { short: string; long: string }> = {
  sharpersist: {
    short: 'Persistence toolkit',
    long: 'Install persistence mechanisms (Registry, Scheduled Tasks, Startup folder) to maintain access after reboot.',
  },
  nanodump: {
    short: 'Credential dumper',
    long: 'Dump LSASS memory to extract credentials without triggering traditional detection methods.',
  },
  rubeus: {
    short: 'Kerberos attacks',
    long: 'Perform Kerberos attacks including Kerberoasting, AS-REP roasting, ticket manipulation, and delegation abuse.',
  },
  seatbelt: {
    short: 'Host enumeration',
    long: 'Comprehensive host reconnaissance - gather system info, installed software, security products, and misconfigurations.',
  },
  sharphound: {
    short: 'AD collector',
    long: 'Collect Active Directory data for BloodHound - map attack paths, permissions, and relationships.',
  },
  certify: {
    short: 'ADCS attacks',
    long: 'Enumerate and exploit Active Directory Certificate Services (ADCS) misconfigurations.',
  },
  sharpwmi: {
    short: 'WMI execution',
    long: 'Execute commands remotely via Windows Management Instrumentation (WMI).',
  },
  sharpview: {
    short: 'AD enumeration',
    long: 'PowerView functionality in C# - enumerate AD users, groups, computers, GPOs, and ACLs.',
  },
}

function PackageCard({
  pkg,
  onInstall,
  onUninstall,
  isInstalling,
  isUninstalling,
}: {
  pkg: ArmoryPackage
  onInstall: (name: string) => void
  onUninstall: (name: string) => void
  isInstalling: boolean
  isUninstalling: boolean
}) {
  const description = toolDescriptions[pkg.name.toLowerCase()]

  return (
    <Card className={cn(
      "transition-colors",
      pkg.installed && "border-green-500/50 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle className="text-lg">{pkg.name}</CardTitle>
            {description && (
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                {description.short}
              </span>
            )}
          </div>
          {pkg.installed ? (
            <div className="flex items-center gap-1 text-green-500 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>Installed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <XCircle className="h-4 w-4" />
              <span>Not installed</span>
            </div>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">
            {description.long}
          </p>
        )}
        <CardDescription className="mt-2 text-xs">
          Command: <code className="px-1 py-0.5 bg-muted rounded">{pkg.command_name}</code>
          {' • '}
          v{pkg.version}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {pkg.repo_url && (
            <a
              href={pkg.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Documentation
            </a>
          )}
          <div className="flex gap-2 ml-auto">
            {pkg.installed ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onUninstall(pkg.name)}
                disabled={isUninstalling}
              >
                {isUninstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Uninstall
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => onInstall(pkg.name)}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Install
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function Armory() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showInstalled, setShowInstalled] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['armory', showInstalled, search],
    queryFn: () => armoryApi.list(showInstalled, search || undefined),
  })

  const installMutation = useMutation({
    mutationFn: (name: string) => armoryApi.install(name),
    onMutate: (name) => setPendingAction(`install-${name}`),
    onSuccess: (result) => {
      toast({
        title: 'Package Installed',
        description: result.message,
      })
      queryClient.invalidateQueries({ queryKey: ['armory'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Installation Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
    onSettled: () => setPendingAction(null),
  })

  const uninstallMutation = useMutation({
    mutationFn: (name: string) => armoryApi.uninstall(name),
    onMutate: (name) => setPendingAction(`uninstall-${name}`),
    onSuccess: (result) => {
      toast({
        title: 'Package Uninstalled',
        description: result.message,
      })
      queryClient.invalidateQueries({ queryKey: ['armory'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Uninstallation Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
    onSettled: () => setPendingAction(null),
  })

  const packages: ArmoryPackage[] = data?.packages || []
  const installedCount = data?.installed_count || 0
  const totalCount = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tools & Extensions</h1>
          <p className="text-muted-foreground">
            Install and manage post-exploitation tools for your operations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Installed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{installedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {totalCount - installedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search packages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showInstalled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowInstalled(!showInstalled)}
        >
          {showInstalled ? 'Show All' : 'Installed Only'}
        </Button>
      </div>

      {/* OSEP Recommended */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            OSEP Recommended Extensions
          </CardTitle>
          <CardDescription>
            Essential tools for OSEP exam. Install these before the exam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['sharpersist', 'nanodump', 'rubeus', 'seatbelt', 'sharphound', 'certify'].map((name) => {
              const pkg = packages.find((p) => p.name === name)
              const isInstalled = pkg?.installed || false
              return (
                <div
                  key={name}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm flex items-center gap-1",
                    isInstalled
                      ? "bg-green-500/20 text-green-500"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isInstalled ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {name}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Package List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No packages found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.name}
              pkg={pkg}
              onInstall={(name) => installMutation.mutate(name)}
              onUninstall={(name) => uninstallMutation.mutate(name)}
              isInstalling={pendingAction === `install-${pkg.name}`}
              isUninstalling={pendingAction === `uninstall-${pkg.name}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
