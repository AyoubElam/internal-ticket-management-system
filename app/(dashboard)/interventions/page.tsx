'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, MapPin, Search, Shield, Plus, X, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { InterventionBadge, PriorityBadge } from '@/components/status-badge'
import { timeAgo, getInitials, INTERVENTION_STATUS_LABELS } from '@/lib/helpers'
import type { InterventionStatus, TicketPriority } from '@/lib/types'

const ALL_STATUSES: InterventionStatus[] = ['traveling', 'in_progress', 'completed']

// Forward transitions a technician can move an intervention through.
const NEXT_INTERVENTION_STATUS: Record<InterventionStatus, InterventionStatus | null> = {
  traveling:   'in_progress',
  in_progress: 'completed',
  completed:   null,
}

type Intervention = {
  id: number
  ticket_id: number
  technician_id: number
  status: InterventionStatus
  notes: string | null
  created_at: string
  updated_at: string
  ticket_title: string
  priority: TicketPriority
  category: string
  technician_name: string
  location_label?: string
}

type Technician = { id: number; first_name: string; last_name: string }
type UnassignedTicket = { id: number; title: string; priority: TicketPriority; location_label?: string }

export default function InterventionsPage() {
  const { user } = useAuth()
  const [filterStatus, setFilterStatus] = useState<InterventionStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAssign, setShowAssign] = useState(false)

  const canManage = !!user && ['admin', 'support_agent'].includes(user.role)
  const isTechnician = user?.role === 'technician'

  async function fetchInterventions() {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const qs = params.toString()
      const res = await fetch(`http://localhost:4000/api/interventions${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load interventions.')
      setInterventions(Array.isArray(data) ? data : data.data || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInterventions() }, [filterStatus])

  const filtered = useMemo(() => {
    return interventions
      .filter(i => {
        if (!search) return true
        const q = search.toLowerCase()
        return i.ticket_title?.toLowerCase().includes(q) || String(i.ticket_id).includes(q)
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [interventions, search])

  const totalActive    = interventions.filter(i => i.status !== 'completed').length
  const totalCompleted = interventions.filter(i => i.status === 'completed').length

  if (!user || !['admin', 'support_agent', 'technician'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Interventions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isTechnician ? 'Your field assignments' : 'All technician field interventions'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Assign Technician
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Interventions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{interventions.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalActive}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{totalCompleted}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search interventions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          {(['all', ...ALL_STATUSES] as (InterventionStatus | 'all')[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? 'All' : INTERVENTION_STATUS_LABELS[s as InterventionStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
            No interventions found.
          </div>
        ) : filtered.map(intervention => (
          <InterventionCard
            key={intervention.id}
            intervention={intervention}
            canUpdate={isTechnician && intervention.technician_id === user.id}
            onUpdated={fetchInterventions}
          />
        ))}
      </div>

      {showAssign && (
        <AssignModal onClose={() => setShowAssign(false)} onAssigned={() => { setShowAssign(false); fetchInterventions() }} />
      )}
    </div>
  )
}

function InterventionCard({
  intervention, canUpdate, onUpdated,
}: { intervention: Intervention; canUpdate: boolean; onUpdated: () => void }) {
  const [notes, setNotes] = useState(intervention.notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const nextStatus = NEXT_INTERVENTION_STATUS[intervention.status]

  async function advance() {
    if (!nextStatus) return
    if (nextStatus === 'completed' && !notes.trim()) {
      setErr('Add a closing report note before marking this complete.')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/interventions/${intervention.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus, notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update intervention.')
      onUpdated()
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          intervention.status === 'completed'  ? 'bg-green-500/10' :
          intervention.status === 'traveling'  ? 'bg-blue-500/10' : 'bg-amber-500/10'
        }`}>
          <Wrench className={`w-4 h-4 ${
            intervention.status === 'completed'  ? 'text-green-400' :
            intervention.status === 'traveling'  ? 'text-blue-400' : 'text-amber-400'
          }`} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <Link
                href={`/tickets/${intervention.ticket_id}`}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                Ticket #{intervention.ticket_id}
                {intervention.ticket_title && ` — ${intervention.ticket_title}`}
              </Link>
              {intervention.location_label && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3" /> {intervention.location_label}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={intervention.priority} size="sm" />
              <InterventionBadge status={intervention.status} />
            </div>
          </div>

          {!canUpdate && intervention.notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {intervention.notes}
            </p>
          )}

          {canUpdate && (
            <div className="space-y-2 pt-1">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={nextStatus === 'completed' ? 'Closing report — required to mark complete…' : 'Notes…'}
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              {err && <p className="text-xs text-destructive">{err}</p>}
              {nextStatus && (
                <button
                  onClick={advance}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saving ? 'Updating…' : `Mark as ${INTERVENTION_STATUS_LABELS[nextStatus]}`}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {getInitials(intervention.technician_name?.split(' ')[0] || '', intervention.technician_name?.split(' ')[1] || '')}
              </div>
              <span className="text-xs text-muted-foreground">{intervention.technician_name}</span>
            </div>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Updated {timeAgo(intervention.updated_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Assign a technician to a ticket — this is now the ONLY assignment path.
// It creates the interventions row AND sets the ticket's assigned_to_id/status.
function AssignModal({ onClose, onAssigned }: { onClose: () => void; onAssigned: () => void }) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [openTickets, setOpenTickets] = useState<UnassignedTicket[]>([])
  const [ticketId, setTicketId] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    Promise.all([
      fetch('http://localhost:4000/api/users?role=technician&is_active=true', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch('http://localhost:4000/api/tickets?status=created', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([techData, ticketData]) => {
      setTechnicians(Array.isArray(techData) ? techData : techData.data || [])
      setOpenTickets(ticketData.data || [])
    }).catch(() => { /* silent — selects just stay empty */ })
  }, [])

  async function handleSubmit() {
    if (!ticketId || !technicianId) return
    setSubmitting(true)
    setErr('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:4000/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticket_id: Number(ticketId), technician_id: Number(technicianId), notes: notes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign technician.')
      onAssigned()
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Assign Technician</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {err && <p className="text-xs text-destructive">{err}</p>}

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Ticket</label>
          <select
            value={ticketId}
            onChange={e => setTicketId(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select an unassigned ticket…</option>
            {openTickets.map(t => (
              <option key={t.id} value={t.id}>
                #{t.id} — {t.title} ({t.priority}){t.location_label ? ` · ${t.location_label}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Technician</label>
          <select
            value={technicianId}
            onChange={e => setTechnicianId(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a technician…</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !ticketId || !technicianId}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}