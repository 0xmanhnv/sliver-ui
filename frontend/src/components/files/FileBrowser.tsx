import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Folder,
  File,
  ChevronRight,
  Home,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  ArrowUp,
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  Loader2,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { formatBytes, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileInfo {
  name: string
  is_dir: boolean
  size: number
  mode: string
  mod_time?: string
}

interface FileBrowserProps {
  sessionId: string
  initialPath?: string
  onClose?: () => void
}

export function FileBrowser({ sessionId, initialPath, onClose }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '/')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ file: string; progress: number } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch directory listing
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', sessionId, currentPath],
    queryFn: () => sessionsApi.files(sessionId, currentPath),
    enabled: !!sessionId,
  })

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const blob = await sessionsApi.download(sessionId, filePath)
      return { blob, filename: filePath.split('/').pop()?.split('\\').pop() || 'download' }
    },
    onSuccess: ({ blob, filename }) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({ title: 'File downloaded successfully' })
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Download failed', description: error.message })
    },
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, remotePath }: { file: File; remotePath: string }) => {
      setUploadProgress({ file: file.name, progress: 0 })
      const result = await sessionsApi.upload(sessionId, remotePath, file)
      setUploadProgress(null)
      return result
    },
    onSuccess: () => {
      toast({ title: 'File uploaded successfully' })
      refetch()
    },
    onError: (error: any) => {
      setUploadProgress(null)
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message })
    },
  })

  // Create directory mutation
  const mkdirMutation = useMutation({
    mutationFn: (path: string) => sessionsApi.mkdir(sessionId, path),
    onSuccess: () => {
      toast({ title: 'Directory created' })
      setShowNewFolderInput(false)
      setNewFolderName('')
      refetch()
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Failed to create directory', description: error.message })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (path: string) => sessionsApi.deleteFile(sessionId, path),
    onSuccess: () => {
      toast({ title: 'Deleted successfully' })
      setDeleteConfirm(null)
      setSelectedFiles([])
      refetch()
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Delete failed', description: error.message })
    },
  })

  // Get file icon based on extension
  const getFileIcon = (filename: string, isDir: boolean) => {
    if (isDir) return <Folder className="h-5 w-5 text-yellow-500" />

    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'txt':
      case 'log':
      case 'md':
      case 'cfg':
      case 'conf':
      case 'ini':
        return <FileText className="h-5 w-5 text-gray-400" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
      case 'ico':
        return <FileImage className="h-5 w-5 text-purple-400" />
      case 'js':
      case 'ts':
      case 'py':
      case 'go':
      case 'rs':
      case 'c':
      case 'cpp':
      case 'h':
      case 'java':
      case 'php':
      case 'rb':
      case 'sh':
      case 'ps1':
      case 'bat':
        return <FileCode className="h-5 w-5 text-green-400" />
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
      case '7z':
      case 'xz':
        return <FileArchive className="h-5 w-5 text-orange-400" />
      default:
        return <File className="h-5 w-5 text-gray-400" />
    }
  }

  // Navigate to path
  const navigateTo = (path: string) => {
    setCurrentPath(path)
    setSelectedFiles([])
  }

  // Go up one directory
  const goUp = () => {
    const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
    const separator = isWindows ? '\\' : '/'
    const parts = currentPath.split(/[/\\]/).filter(Boolean)
    parts.pop()

    if (isWindows) {
      navigateTo(parts.length > 0 ? parts.join('\\') : 'C:\\')
    } else {
      navigateTo('/' + parts.join('/') || '/')
    }
  }

  // Handle file/folder click
  const handleItemClick = (item: FileInfo) => {
    if (item.is_dir) {
      const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
      const separator = isWindows ? '\\' : '/'
      const newPath = currentPath.endsWith(separator) || currentPath === '/'
        ? `${currentPath}${item.name}`
        : `${currentPath}${separator}${item.name}`
      navigateTo(newPath)
    } else {
      // Toggle selection
      setSelectedFiles(prev =>
        prev.includes(item.name)
          ? prev.filter(f => f !== item.name)
          : [...prev, item.name]
      )
    }
  }

  // Handle download
  const handleDownload = (filename: string) => {
    const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
    const separator = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(separator) || currentPath === '/'
      ? `${currentPath}${filename}`
      : `${currentPath}${separator}${filename}`
    downloadMutation.mutate(fullPath)
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
    const separator = isWindows ? '\\' : '/'
    const remotePath = currentPath.endsWith(separator) || currentPath === '/'
      ? `${currentPath}${file.name}`
      : `${currentPath}${separator}${file.name}`

    uploadMutation.mutate({ file, remotePath })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle create folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return

    const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
    const separator = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(separator) || currentPath === '/'
      ? `${currentPath}${newFolderName}`
      : `${currentPath}${separator}${newFolderName}`

    mkdirMutation.mutate(fullPath)
  }

  // Handle delete
  const handleDelete = (filename: string) => {
    const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
    const separator = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(separator) || currentPath === '/'
      ? `${currentPath}${filename}`
      : `${currentPath}${separator}${filename}`

    deleteMutation.mutate(fullPath)
  }

  // Build breadcrumb parts
  const breadcrumbParts = currentPath.split(/[/\\]/).filter(Boolean)

  const files = data?.files || []
  const sortedFiles = [...files].sort((a, b) => {
    // Directories first
    if (a.is_dir && !b.is_dir) return -1
    if (!a.is_dir && b.is_dir) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Button variant="ghost" size="icon" onClick={goUp} title="Go up">
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigateTo(initialPath || '/')} title="Home">
          <Home className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <div className="h-6 w-px bg-border mx-2" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          title="Upload file"
        >
          <Upload className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowNewFolderInput(!showNewFolderInput)}
          title="New folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>

        {selectedFiles.length > 0 && (
          <>
            <div className="h-6 w-px bg-border mx-2" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectedFiles.forEach(f => handleDownload(f))}
              disabled={downloadMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              Download ({selectedFiles.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirm(selectedFiles[0])}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </>
        )}

        <div className="flex-1" />

        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm">Uploading: {uploadProgress.file}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-2 bg-muted/50 text-sm overflow-x-auto">
        <button
          onClick={() => navigateTo(initialPath || '/')}
          className="hover:text-primary flex items-center"
        >
          <Home className="h-4 w-4" />
        </button>
        {breadcrumbParts.map((part, index) => (
          <div key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => {
                const isWindows = currentPath.includes('\\') || currentPath.match(/^[A-Z]:/i)
                const path = isWindows
                  ? breadcrumbParts.slice(0, index + 1).join('\\')
                  : '/' + breadcrumbParts.slice(0, index + 1).join('/')
                navigateTo(path)
              }}
              className="hover:text-primary px-1"
            >
              {part}
            </button>
          </div>
        ))}
      </div>

      {/* New folder input */}
      {showNewFolderInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
          <FolderPlus className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="New folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') {
                setShowNewFolderInput(false)
                setNewFolderName('')
              }
            }}
          />
          <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName || mkdirMutation.isPending}>
            {mkdirMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewFolderInput(false)
              setNewFolderName('')
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm">Delete {selectedFiles.length} item(s)?</span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => selectedFiles.forEach(f => handleDelete(f))}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Delete'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Folder className="h-12 w-12 mb-2 opacity-50" />
            <p>Empty directory</p>
            <p className="text-xs mt-1">Drag and drop files or click Upload</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left text-sm">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium w-24">Size</th>
                <th className="p-2 font-medium w-40">Modified</th>
                <th className="p-2 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file.name}
                  className={cn(
                    'hover:bg-muted/50 cursor-pointer border-b border-border/50',
                    selectedFiles.includes(file.name) && 'bg-primary/10'
                  )}
                  onClick={() => handleItemClick(file)}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.name, file.is_dir)}
                      <span className={cn(file.is_dir && 'font-medium')}>
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-sm text-muted-foreground">
                    {file.is_dir ? '-' : formatBytes(file.size)}
                  </td>
                  <td className="p-2 text-sm text-muted-foreground">
                    {file.mod_time ? formatDate(file.mod_time) : '-'}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {!file.is_dir && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(file.name)
                          }}
                          disabled={downloadMutation.isPending}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFiles([file.name])
                          setDeleteConfirm(file.name)
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t text-sm text-muted-foreground bg-muted/30 flex items-center justify-between">
        <span>
          {sortedFiles.length} items
          {selectedFiles.length > 0 && ` • ${selectedFiles.length} selected`}
        </span>
        <span className="text-xs">
          {currentPath}
        </span>
      </div>
    </div>
  )
}
