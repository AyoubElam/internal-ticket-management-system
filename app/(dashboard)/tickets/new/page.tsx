'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Ticket, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { CATEGORY_LABELS, PRIORITY_LABELS } from '@/lib/helpers'
import type { TicketCategory, TicketPriority } from '@/lib/types'
import type { PickedLocation } from '@/components/ZoneMapPicker'

// Leaflet touches `window`, so the picker can't be server-rendered.
const ZoneMapPicker = dynamic(() => import('@/components/ZoneMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 rounded-lg border border-border bg-card animate-pulse" />
  ),
})

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']

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
  const [location,    setLocation]    = useState<PickedLocation | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState('')

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!location) {
      setError('Please pick your location on the map before submitting.')
      return
    }

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
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          // zone_id removed — zones table was dropped. Location is now
          // purely lat/lng/label from the map picker, no zone matching.
          location_lat: location.lat,
          location_lng: location.lng,
          location_label: location.label,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create ticket.')

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

        {/* Location — free-text place picked on the map, purely lat/lng/label now */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Location <span className="text-red-400">*</span>
          </label>
          <ZoneMapPicker value={location} onChange={setLocation} />
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
            disabled={submitting || !title.trim() || !description.trim() || !location}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}