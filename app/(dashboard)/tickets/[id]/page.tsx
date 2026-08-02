'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Clock, MessageSquare,
  Lock, Send, AlertTriangle, Pencil, X, Save, CheckCircle2, Wrench, Star,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { formatDateTime, timeAgo, getInitials, ROLE_LABELS } from '@/lib/helpers'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']

// Only admin/support_agent transitions now — technicians move a ticket
// forward exclusively via PATCH /interventions/:id (traveling → in_progress
// → completed), which itself syncs the ticket status server-side.
const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  created:     ['assigned'],
  assigned:    [],           // technician moves this via Interventions, not here
  in_progress: [],           // technician moves this via Interventions, not here
  resolved:    ['closed'],
  closed:      [],
  cancelled:   [],
}

type Ticket = {
  id: number
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  resolved_at?: string
  created_by_id: number
  created_by_name?: string
  assigned_to_id?: number
  assigned_to_name?: string
  employee_rating?: number | null
  rating_comment?: string | null
  comments: Comment[]
}

type Comment = {
  id: number
  ticket_id: number
  user_id: number
  content: string
  is_internal: number
  created_at: string
  user_name?: string
  user_role?: string
}

type TechnicianRatingSummary = {
  technician_id: number
  rating_count: number
  avg_rating: number | null
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()

  const [ticket, setTicket]   = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [comment, setComment]         = useState('')
  const [isInternal, setIsInternal]   = useState(false)
  const [posting, setPosting]         = useState(false)

  const [editing, setEditing]     = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc]   = useState('')
  const [editCat, setEditCat]     = useState<TicketCategory>('network_support')
  const [editPrio, setEditPrio]   = useState<TicketPriority>('medium')
  const [saving, setSaving]       = useState(false)
  const [editError, setEditError] = useState('')

  const [cancelling, setCancelling] = useState(false)

  const [updatingStatus, setUpdatingStatus]     = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [manageError, setManageError]           = useState('')

  const [technicians, setTechnicians] = useState<{ id: number; first_name: string; last_name: string }[]>([])
  const [assigning, setAssigning]     = useState(false)

  // Rating — employee's own submission on this ticket
  const [ratingValue, setRatingValue]   = useState(0)
  const [ratingHover, setRatingHover]   = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingError, setRatingError]   = useState('')

  // Technician's overall average — shown to admin/agent
  const [techRating, setTechRating] = useState<TechnicianRatingSummary | null>(null)

  // Safe to compute before the early returns below — doesn't touch `ticket`.
  const isAdmin = user?.role === 'admin'
  const isAgent = user?.role === 'support_agent'
  const canManage = isAdmin || isAgent
  const isTechnician = user?.role === 'technician'

  useEffect(() => {
    fetchTicket()
  }, [id])

  // Fetch technicians for the assign dropdown. Must live before any early
  // `return` below — hooks can't be called conditionally.
  useEffect(() => {
    if (!canManage) return
    const fetchTechnicians = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:4000/api/users?role=technician&is_active=true', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) setTechnicians(data)
      } catch {
        // silent — assign list just won't populate
      }
    }
    fetchTechnicians()
  }, [canManage])

  // Technician's average rating — shown to admin/support_agent once a
  // technician is assigned. Technicians could see their own via the same
  // endpoint, but that's not surfaced here (no need on this page for them).
  useEffect(() => {
    if (!canManage || !ticket?.assigned_to_id) return
    const fetchTechRating = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`http://localhost:4000/api/ratings/technician/${ticket.assigned_to_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) setTechRating(data)
      } catch {
        // silent — badge just won't show
      }
    }
    fetchTechRating()
  }, [canManage, ticket?.assigned_to_id])

  async function fetchTicket() {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load ticket.')
      setTicket(data)
      setEditTitle(data.title)
      setEditDesc(data.description)
      setEditCat(data.category)
      setEditPrio(data.priority)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Loading ticket…</p>
  }

  if (error || !ticket || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-muted-foreground">{error || 'Ticket not found.'}</p>
        <Link href="/tickets" className="text-sm text-primary hover:underline">Back to tickets</Link>
      </div>
    )
  }

  const canEdit = ['admin', 'support_agent'].includes(user.role) || ticket.assigned_to_id === user.id
  const canComment = canEdit || ticket.created_by_id === user.id

  // Creator can edit their own ticket while it's still fresh ('created').
  // Admin can edit everything, any time. Agents never get this edit form —
  // they only get status + technician below.
  const canEditTicket = (ticket.created_by_id === user.id && ticket.status === 'created') || isAdmin
  const canCancelTicket = ticket.created_by_id === user.id && ticket.status === 'created'

  const isAssignedTechnician = isTechnician && ticket.assigned_to_id === user.id
  // Status/priority management panel is admin/support_agent only now.
  // Technicians get a pointer to the Interventions page instead — see below.
  const visibleNextStatuses = NEXT_STATUSES[ticket.status]

  async function patchTicket(body: Record<string, unknown>) {
    const token = localStorage.getItem('token')
    const res = await fetch(`http://localhost:4000/api/tickets/${ticket!.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update ticket.')
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    setManageError('')
    setUpdatingStatus(true)
    try {
      await patchTicket({ status: newStatus })
      fetchTicket()
    } catch (err: any) {
      setManageError(err.message || 'Something went wrong.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handlePriorityChange(newPriority: TicketPriority) {
    if (!ticket || newPriority === ticket.priority) return
    setManageError('')
    setUpdatingPriority(true)
    try {
      await patchTicket({ priority: newPriority })
      fetchTicket()
    } catch (err: any) {
      setManageError(err.message || 'Something went wrong.')
    } finally {
      setUpdatingPriority(false)
    }
  }

  // Uses POST /interventions (not a plain PATCH) so assigning a technician
  // here behaves the same as the Ticket Queue page: it both reassigns the
  // ticket and creates the intervention/dispatch record the technician
  // sees on the Interventions page.
  async function handleAssign(technicianId: number) {
    setManageError('')
    setAssigning(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:4000/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_id: ticket!.id, technician_id: technicianId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign technician.')
      fetchTicket()
    } catch (err: any) {
      setManageError(err.message || 'Something went wrong.')
    } finally {
      setAssigning(false)
    }
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() || !ticket) return
    setPosting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: comment.trim(), is_internal: isInternal }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to post comment.')
      }
      setComment('')
      setIsInternal(false)
      fetchTicket()
    } catch (err: any) {
      alert(err.message || 'Something went wrong.')
    } finally {
      setPosting(false)
    }
  }

  async function handleSaveEdit() {
    if (!ticket) return
    setSaving(true)
    setEditError('')
    try {
      const token = localStorage.getItem('token')

      const body: Record<string, unknown> = {
        title: editTitle,
        description: editDesc,
        category: editCat,
        priority: editPrio,
      }

      // Admin edits go through the general PATCH /tickets/:id (allowed to
      // touch everything). The creator's own edit still goes through the
      // dedicated /edit endpoint, which stays locked to status='created'.
      const isOwnerEdit = ticket.created_by_id === user!.id && !isAdmin
      const url = isOwnerEdit
        ? `http://localhost:4000/api/tickets/${ticket.id}/edit`
        : `http://localhost:4000/api/tickets/${ticket.id}`

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update ticket.')
      setEditing(false)
      fetchTicket()
    } catch (err: any) {
      setEditError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitRating() {
    if (!ticket || ratingValue < 1) return
    setSubmittingRating(true)
    setRatingError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:4000/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticket_id: ticket.id, rating: ratingValue, comment: ratingComment.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating.')
      fetchTicket()
    } catch (err: any) {
      setRatingError(err.message || 'Something went wrong.')
    } finally {
      setSubmittingRating(false)
    }
  }

  async function handleCancelTicket() {
    if (!ticket) return
    if (!confirm('Are you sure you want to cancel this ticket? This cannot be undone.')) return

    setCancelling(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${ticket.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel ticket.')
      fetchTicket()
    } catch (err: any) {
      alert(err.message || 'Something went wrong.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
            <CategoryBadge category={ticket.category} />
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1.5 text-balance">{ticket.title}</h1>
        </div>

        {(canEditTicket || canCancelTicket) && !editing && (
          <div className="flex items-center gap-2">
            {canEditTicket && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {canCancelTicket && (
              <button
                onClick={handleCancelTicket}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> {cancelling ? 'Cancelling…' : 'Cancel Ticket'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: description + comments */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description / Edit form */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            {!editing ? (
              <>
                <h2 className="text-sm font-semibold text-foreground">Description</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{ticket.description}</p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Edit Ticket</h2>
                  <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {editError && <p className="text-xs text-destructive">{editError}</p>}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Title</label>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={120}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Description</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Category</label>
                    <select
                      value={editCat}
                      onChange={e => setEditCat(e.target.value as TicketCategory)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Priority</label>
                    <select
                      value={editPrio}
                      onChange={e => setEditPrio(e.target.value as TicketPriority)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editTitle.trim() || !editDesc.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manage: assign + status (+ priority for admin only).
              admin/support_agent ONLY. Agents can only touch status and
              assign a technician here — nothing else. Admin gets priority
              too; title/description are edited via the form above instead.
              Technicians no longer get status buttons here at all (their
              PATCH /tickets/:id is blocked server-side). They get a
              pointer to the Interventions page instead, further below. */}
          {canManage && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Manage Ticket</h2>

              {manageError && <p className="text-xs text-destructive">{manageError}</p>}

              {/* Assign to technician. Calls POST /interventions, same as
                  the Ticket Queue page, so it also creates the
                  intervention/dispatch record. */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Assign to Technician</label>
                {technicians.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No technicians available.</p>
                ) : ticket.assigned_to_id ? (
                  <p className="text-xs text-muted-foreground">
                    Already assigned to {ticket.assigned_to_name}. Reassignment isn't supported yet —
                    manage further progress from the Interventions page.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {technicians.map(tech => (
                      <button
                        key={tech.id}
                        onClick={() => handleAssign(tech.id)}
                        disabled={assigning}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors border-border hover:border-primary/50 hover:bg-accent disabled:opacity-60"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {getInitials(tech.first_name, tech.last_name)}
                        </div>
                        <span className="text-xs text-foreground">{tech.first_name} {tech.last_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status progression — created→assigned and resolved→closed
                  only. assigned→in_progress→resolved now happens via the
                  technician's intervention, not here. */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                {visibleNextStatuses.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {visibleNextStatuses.map(ns => (
                      <button
                        key={ns}
                        onClick={() => handleStatusChange(ns)}
                        disabled={updatingStatus}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {updatingStatus ? 'Updating…' : `Mark as ${ns.replace('_', ' ')}`}
                      </button>
                    ))}
                  </div>
                ) : ['assigned', 'in_progress'].includes(ticket.status) ? (
                  <p className="text-xs text-muted-foreground">
                    In progress on the technician's side — check the{' '}
                    <Link href="/interventions" className="text-primary hover:underline">Interventions page</Link>{' '}
                    for live status and their closing report.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This ticket is {ticket.status} — no further transitions available.
                  </p>
                )}
              </div>

              {/* Priority selector — admin only. Agents don't get this. */}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRIORITIES.map(p => (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        disabled={updatingPriority || p === ticket.priority}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                          p === ticket.priority
                            ? 'bg-primary/10 border-primary text-primary cursor-default'
                            : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Technician's own assigned ticket: no status controls here anymore —
              point them to the Interventions page where they actually work. */}
          {isAssignedTechnician && (
            <Link
              href="/interventions"
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Update your intervention</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Log status (traveling / in progress / completed) and your closing report from the Interventions page.
                </p>
              </div>
            </Link>
          )}

          {/* Rating — employee rates the technician once the ticket is
              finished. One rating per ticket, enforced server-side too. */}
          {ticket.created_by_id === user.id && ['resolved', 'closed'].includes(ticket.status) && ticket.assigned_to_id && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {ticket.employee_rating ? 'Your Rating' : 'Rate the Technician'}
              </h2>

              {ticket.employee_rating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={cn(
                          'w-5 h-5',
                          n <= (ticket.employee_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-border'
                        )}
                      />
                    ))}
                  </div>
                  {ticket.rating_comment && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                      {ticket.rating_comment}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    How was your experience with {ticket.assigned_to_name || 'the technician'} on this ticket?
                  </p>
                  {ratingError && <p className="text-xs text-destructive">{ratingError}</p>}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatingValue(n)}
                        onMouseEnter={() => setRatingHover(n)}
                        onMouseLeave={() => setRatingHover(0)}
                        aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={cn(
                            'w-6 h-6 transition-colors',
                            n <= (ratingHover || ratingValue) ? 'fill-amber-400 text-amber-400' : 'text-border hover:text-amber-400/50'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    placeholder="Optional comment…"
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <button
                    onClick={handleSubmitRating}
                    disabled={ratingValue < 1 || submittingRating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {submittingRating ? 'Submitting…' : 'Submit Rating'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Activity <span className="text-muted-foreground font-normal">({ticket.comments?.length || 0})</span>
              </h2>
            </div>

            <div className="divide-y divide-border">
              {(!ticket.comments || ticket.comments.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No comments yet.</p>
              )}
              {ticket.comments?.map(c => (
                <div key={c.id} className={cn(
                  'px-5 py-4 flex gap-3',
                  c.is_internal ? 'bg-amber-500/5 border-l-2 border-amber-500/40' : ''
                )}>
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                    {c.user_name ? getInitials(c.user_name.split(' ')[0], c.user_name.split(' ')[1] || '') : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{c.user_name || 'Unknown'}</span>
                      {c.user_role && <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[c.user_role as keyof typeof ROLE_LABELS] || c.user_role}</span>}
                      {!!c.is_internal && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">
                          <Lock className="w-2.5 h-2.5" /> Internal
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {canComment && (
              <form onSubmit={handleSendComment} className="px-5 py-4 border-t border-border space-y-3">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                />
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {['admin','support_agent'].includes(user.role) && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={e => setIsInternal(e.target.checked)}
                        className="accent-amber-400"
                      />
                      Internal note (not visible to employee)
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={!comment.trim() || posting}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  >
                    <Send className="w-3.5 h-3.5" /> {posting ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right: details sidebar */}
        <div className="space-y-4">
          <DetailCard title="Details">
            <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Created" value={formatDateTime(ticket.created_at)} />
            <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Updated" value={formatDateTime(ticket.updated_at)} />
            {ticket.resolved_at && (
              <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Resolved" value={formatDateTime(ticket.resolved_at)} />
            )}
          </DetailCard>

          <DetailCard title="Requester">
            {ticket.created_by_name ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {getInitials(ticket.created_by_name.split(' ')[0], ticket.created_by_name.split(' ')[1] || '')}
                </div>
                <p className="text-xs font-semibold text-foreground">{ticket.created_by_name}</p>
              </div>
            ) : <span className="text-xs text-muted-foreground">Unknown</span>}
          </DetailCard>

          <DetailCard title="Assigned To">
            {ticket.assigned_to_name ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">
                    {getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '')}
                  </div>
                  <p className="text-xs font-semibold text-foreground">{ticket.assigned_to_name}</p>
                </div>
                {canManage && techRating && techRating.rating_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pl-11">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground">{techRating.avg_rating}</span>
                    <span>({techRating.rating_count} rating{techRating.rating_count === 1 ? '' : 's'})</span>
                  </div>
                )}
                {canManage && techRating && techRating.rating_count === 0 && (
                  <p className="text-xs text-muted-foreground pl-11">No ratings yet</p>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xs text-foreground mt-0.5 break-words">{value}</p>
      </div>
    </div>
  )
}