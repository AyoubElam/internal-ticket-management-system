'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ticket, AlertCircle, Paperclip, X, Upload } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { CATEGORY_LABELS, PRIORITY_LABELS } from '@/lib/helpers'
import type { TicketCategory, TicketPriority } from '@/lib/types'

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']
const MAX_FILES = 3
const MAX_MB = 10

const PRIORITY_DESC: Record<TicketPriority, string> = {
  low:      'Minor issue, no time constraint',
  medium:   'Moderate impact, resolve within 24h',
  high:     'Significant impact, resolve within 4h',
  critical: 'Service down, immediate action required',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:      'border-green-500/40 bg-green-500/5',
  medium:   'border-amber-500/40 bg-amber-500/5',
  high:     'border-orange-500/40 bg-orange-500/5',
  critical: 'border-red-500/40 bg-red-500/5',
}

export default function NewTicketPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState<TicketCategory>('network_support')
  const [priority,    setPriority]    = useState<TicketPriority>('medium')
  const [files,       setFiles]       = useState<File[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState('')

  const inputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    if (files.length + selected.length > MAX_FILES) {
      setError(`You can attach a maximum of ${MAX_FILES} files per ticket.`)
      return
    }
    for (const file of selected) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" exceeds the ${MAX_MB} MB size limit.`)
        return
      }
    }
    setError('')
    setFiles(prev => [...prev, ...selected])
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:4000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, category, priority }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create ticket.')

      const ticketId = data.id

      // Upload attachments if any
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          await fetch(`http://localhost:4000/api/tickets/${ticketId}/attachments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })
        }
      }

      setSuccess(true)
      setTimeout(() => router.push('/tickets'), 1500)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <Ticket className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Ticket Submitted!</h2>
        <p className="text-sm text-muted-foreground">Redirecting to your tickets…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-foreground">Submit a New Request</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Fill in the details below to create a support ticket.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Category <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  category === cat
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Brief summary of the issue…"
            required
            maxLength={120}
            className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide as much detail as possible — what happened, when it started, and what you have already tried…"
            required
            rows={5}
            className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  priority === p
                    ? PRIORITY_COLORS[p] + ' border-2'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <p className="text-sm font-semibold text-foreground capitalize">{PRIORITY_LABELS[p]}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{PRIORITY_DESC[p]}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Attachments (Optional, max 3) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              Attachments <span className="text-xs text-muted-foreground font-normal">(Optional, max 3)</span>
            </label>
            <span className="text-xs text-muted-foreground">{files.length}/{MAX_FILES}</span>
          </div>

          {files.length < MAX_FILES && (
            <div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-muted-foreground font-medium transition-colors"
              >
                <Upload className="w-4 h-4 text-primary" />
                Add attachment (Images, PDF, Word, Excel — max {MAX_MB}MB)
              </button>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-2 pt-1">
              {files.map((file, idx) => {
                const isImg = file.type.startsWith('image/')
                return (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-xl text-sm">
                    {isImg ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/60">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info banner for critical */}
        {priority === 'critical' && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">
              Critical tickets trigger an immediate alert to the support team and escalate automatically after 2 hours if unassigned.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}