'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Paperclip, Upload, X, Download, Trash2, FileText,
  Image as ImageIcon, File, FileSpreadsheet, AlertCircle, Loader2, Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/helpers'

const MAX_FILES = 3
const MAX_MB    = 10

interface Attachment {
  id: number
  file_name: string
  stored_name?: string
  file_size: number
  mime_type: string
  created_at: string
  uploaded_by_name: string
}

function fileIcon(mime: string) {
  if (mime === 'application/pdf')          return <FileText className="w-5 h-5 text-red-500" />
  if (mime.includes('spreadsheet') || mime.includes('excel'))
                                           return <FileSpreadsheet className="w-5 h-5 text-green-500" />
  return <File className="w-5 h-5 text-muted-foreground" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  ticketId: number
  canUpload: boolean  // employee (creator) or technician (assigned) or staff
}

export default function AttachmentsPanel({ ticketId, canUpload }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState('')
  const [dragOver, setDragOver]       = useState(false)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchAttachments() }, [ticketId])

  async function fetchAttachments() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(`http://localhost:4000/api/tickets/${ticketId}/attachments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data  = await res.json()
      if (res.ok) setAttachments(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(file: File) {
    setError('')
    if (attachments.length >= MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files per ticket.`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Max ${MAX_MB} MB.`)
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(`http://localhost:4000/api/tickets/${ticketId}/attachments`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      })
      const data  = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed.')
      await fetchAttachments()
    } catch (err: any) {
      setError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function deleteAttachment(attId: number) {
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(`http://localhost:4000/api/tickets/${ticketId}/attachments/${attId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setAttachments(prev => prev.filter(a => a.id !== attId))
      else {
        const data = await res.json()
        setError(data.error || 'Delete failed.')
      }
    } catch {
      setError('Delete failed.')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const atLimit = attachments.length >= MAX_FILES

  return (
    <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="px-6 md:px-8 py-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Attachments</h2>
          <span className="text-xs font-bold bg-background text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
            {attachments.length}/{MAX_FILES}
          </span>
        </div>
        {canUpload && !atLimit && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={handleFileInput}
        />
      </div>

      <div className="p-6 md:p-8 space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive rounded-xl text-sm font-medium border border-destructive/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Drag-and-drop zone */}
        {canUpload && !atLimit && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-foreground">Uploading…</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-foreground">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground">Images, PDF, Word, Excel — max {MAX_MB} MB</p>
              </>
            )}
          </div>
        )}

        {atLimit && canUpload && (
          <div className="text-center py-3 px-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-600">
            Maximum {MAX_FILES} attachments reached. Delete one to upload a new file.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading attachments…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && attachments.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Paperclip className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm font-medium">No attachments yet.</p>
          </div>
        )}

        {/* File list */}
        {!loading && attachments.length > 0 && (
          <div className="flex flex-col gap-3">
            {attachments.map(att => {
              const isImage = att.mime_type.startsWith('image/')
              const downloadUrl = `http://localhost:4000/api/tickets/${ticketId}/attachments/${att.id}/download`
              const imageUrl = att.stored_name
                ? `http://localhost:4000/uploads/${att.stored_name}`
                : downloadUrl

              return (
                <div
                  key={att.id}
                  className="group flex items-center gap-4 p-3.5 bg-background border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  {/* Image Thumbnail or File Icon */}
                  {isImage ? (
                    <div
                      onClick={() => setPreviewImage({ url: imageUrl, title: att.file_name })}
                      className="w-14 h-14 rounded-xl overflow-hidden bg-muted relative shrink-0 border border-border/60 cursor-pointer group/thumb shadow-xs flex items-center justify-center"
                    >
                      <img
                        src={imageUrl}
                        alt={att.file_name}
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          // Fallback if image load fails
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/40">
                      {fileIcon(att.mime_type)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{att.file_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span>{formatBytes(att.file_size)}</span>
                      <span>·</span>
                      <span>{att.uploaded_by_name}</span>
                      <span>·</span>
                      <span>{timeAgo(att.created_at)}</span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={downloadUrl}
                      download={att.file_name}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => deleteAttachment(att.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-sm font-bold text-foreground truncate">{previewImage.title}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center max-h-[80vh] bg-black/40">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
