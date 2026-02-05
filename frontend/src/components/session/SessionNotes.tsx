import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/services/api'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  StickyNote,
  Tag,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Save,
  X,
  Download,
  Clock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface SessionNotesProps {
  sessionId: string
  sessionType: 'session' | 'beacon'
}

interface Note {
  id: number
  session_id: string
  session_type: string
  content: string
  user_id: number
  username: string
  created_at: string
  updated_at: string
}

interface TagItem {
  id: number
  name: string
  color: string
  description?: string
  created_at: string
}

export function SessionNotes({ sessionId, sessionType }: SessionNotesProps) {
  const [newNote, setNewNote] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Query notes
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['session-notes', sessionId, sessionType],
    queryFn: () => notesApi.getSessionNotes(sessionId, sessionType),
  })

  // Query all tags
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: notesApi.listTags,
  })

  // Query session tags
  const { data: sessionTags = [] } = useQuery({
    queryKey: ['session-tags', sessionId, sessionType],
    queryFn: () => notesApi.getSessionTags(sessionId, sessionType),
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (content: string) => notesApi.createNote(sessionId, content, sessionType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-notes', sessionId, sessionType] })
      setNewNote('')
      toast({ title: 'Note created' })
    },
    onError: () => {
      toast({ title: 'Failed to create note', variant: 'destructive' })
    },
  })

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) =>
      notesApi.updateNote(noteId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-notes', sessionId, sessionType] })
      setEditingNote(null)
      toast({ title: 'Note updated' })
    },
    onError: () => {
      toast({ title: 'Failed to update note', variant: 'destructive' })
    },
  })

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => notesApi.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-notes', sessionId, sessionType] })
      toast({ title: 'Note deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete note', variant: 'destructive' })
    },
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: () => notesApi.createTag(newTagName, newTagColor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
      setNewTagColor('#6366f1')
      toast({ title: 'Tag created' })
    },
    onError: () => {
      toast({ title: 'Failed to create tag', variant: 'destructive' })
    },
  })

  // Add tag to session mutation
  const addTagMutation = useMutation({
    mutationFn: (tagId: number) => notesApi.addTagToSession(sessionId, tagId, sessionType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-tags', sessionId, sessionType] })
      toast({ title: 'Tag added' })
    },
    onError: () => {
      toast({ title: 'Failed to add tag', variant: 'destructive' })
    },
  })

  // Remove tag from session mutation
  const removeTagMutation = useMutation({
    mutationFn: (tagId: number) => notesApi.removeTagFromSession(sessionId, tagId, sessionType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-tags', sessionId, sessionType] })
      toast({ title: 'Tag removed' })
    },
    onError: () => {
      toast({ title: 'Failed to remove tag', variant: 'destructive' })
    },
  })

  // Export data mutation
  const exportMutation = useMutation({
    mutationFn: () => notesApi.exportSessionData(sessionId),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Data exported successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to export data', variant: 'destructive' })
    },
  })

  const handleAddNote = () => {
    if (!newNote.trim()) return
    createNoteMutation.mutate(newNote)
  }

  const handleUpdateNote = () => {
    if (!editingNote || !editContent.trim()) return
    updateNoteMutation.mutate({ noteId: editingNote.id, content: editContent })
  }

  const startEditing = (note: Note) => {
    setEditingNote(note)
    setEditContent(note.content)
  }

  const sessionTagIds = sessionTags.map((t: TagItem) => t.id)
  const availableTags = allTags.filter((t: TagItem) => !sessionTagIds.includes(t.id))

  const colorOptions = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  ]

  return (
    <div className="space-y-6">
      {/* Tags Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Manage Tags
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Tags</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Create new tag */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Create New Tag</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tag name"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="flex-1"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            style={{ backgroundColor: newTagColor }}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <div className="grid grid-cols-5 gap-1 p-2">
                            {colorOptions.map((color) => (
                              <button
                                key={color}
                                className={cn(
                                  'w-6 h-6 rounded border-2',
                                  newTagColor === color ? 'border-white' : 'border-transparent'
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewTagColor(color)}
                              />
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        onClick={() => createTagMutation.mutate()}
                        disabled={!newTagName.trim() || createTagMutation.isPending}
                      >
                        Create
                      </Button>
                    </div>
                  </div>

                  {/* Available tags to add */}
                  {availableTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Add Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag: TagItem) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="cursor-pointer hover:opacity-80"
                            style={{ borderColor: tag.color, color: tag.color }}
                            onClick={() => addTagMutation.mutate(tag.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current session tags */}
                  {sessionTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {sessionTags.map((tag: TagItem) => (
                          <Badge
                            key={tag.id}
                            style={{ backgroundColor: tag.color }}
                            className="text-white"
                          >
                            {tag.name}
                            <button
                              className="ml-1 hover:opacity-80"
                              onClick={() => removeTagMutation.mutate(tag.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sessionTags.length > 0 ? (
              sessionTags.map((tag: TagItem) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color }}
                  className="text-white"
                >
                  {tag.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No tags assigned</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes ({notes.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              Export All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || createNoteMutation.isPending}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </div>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No notes yet</div>
          ) : (
            <div className="space-y-3">
              {notes.map((note: Note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border bg-muted/30"
                >
                  {editingNote?.id === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNote(null)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateNote}
                          disabled={updateNoteMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEditing(note)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {note.username}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
