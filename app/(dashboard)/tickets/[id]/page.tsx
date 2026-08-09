'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Clock, MessageSquare,
  Lock, Send, AlertTriangle, Pencil, X, Save, CheckCircle2, Wrench, Star,
  History, PlusCircle, UserCheck, FileText, UserPlus, Users, Check,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TechnicianSelect } from '@/components/technician-select'
import { formatDateTime, timeAgo, getInitials, ROLE_LABELS } from '@/lib/helpers'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  created:            ['assigned'],
  pending_assignment: [],
  assigned:           [],
  in_progress:        [],
  resolved:           ['closed'],
  closed:             [],
  cancelled:           [],
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
  created_by_role?: string
  assigned_to_id?: number
  assigned_to_name?: string
  assigned_to_role?: string
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

type TimelineEntry = {
  id: number
  action: string
  details: string
  created_at: string
  user_name: string
  user_role: string
}

const STAGES: {
  key: TicketStatus
  label: string
  icon: React.ReactNode
  actions: string[]
}[] = [
  { key: 'created',            label: 'Created',      icon: <PlusCircle className="w-4 h-4" />,   actions: ['CREATE_TICKET'] },
  { key: 'pending_assignment', label: 'Awaiting Accept', icon: <UserCheck className="w-4 h-4" />, actions: ['ASSIGN_TICKET'] },
  { key: 'assigned',           label: 'Accepted',     icon: <CheckCircle2 className="w-4 h-4" />, actions: ['ACCEPT_ASSIGNMENT'] },
  { key: 'in_progress',        label: 'In Progress',  icon: <Wrench className="w-4 h-4" />,        actions: ['IN_PROGRESS_TICKET', 'UPDATE_TICKET'] },
  { key: 'resolved',           label: 'Resolved',     icon: <CheckCircle2 className="w-4 h-4" />,  actions: ['RESOLVE_TICKET'] },
]

const STATUS_ORDER: TicketStatus[] = ['created', 'pending_assignment', 'assigned', 'in_progress', 'resolved']

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
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const [responding, setResponding]       = useState(false)
  const [rejectReason, setRejectReason]   = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [respondError, setRespondError]   = useState('')

  const [updatingStatus, setUpdatingStatus]     = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [manageError, setManageError]           = useState('')

  const [technicians, setTechnicians] = useState<{ id: number; first_name: string; last_name: string }[]>([])
  const [assigning, setAssigning]     = useState(false)

  const [ratingValue, setRatingValue]   = useState(0)
  const [ratingHover, setRatingHover]   = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingError, setRatingError]   = useState('')

  const [techRating, setTechRating] = useState<TechnicianRatingSummary | null>(null)

  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState('')

  const isAdmin = user?.role === 'admin'
  const isAgent = user?.role === 'support_agent'
  const canManage = isAdmin || isAgent
  const isTechnician = user?.role === 'technician'

  useEffect(() => {
    fetchTicket()
    fetchTimeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
        // silent
      }
    }
    fetchTechnicians()
  }, [canManage])

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
        // silent
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

  async function fetchTimeline() {
    setTimelineLoading(true)
    setTimelineError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${id}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load timeline.')
      setTimeline(data)
    } catch (err: any) {
      setTimelineError(err.message || 'Failed to load timeline.')
    } finally {
      setTimelineLoading(false)
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
  const canEditTicket = (ticket.created_by_id === user.id && ticket.status === 'created') || isAdmin
  const canCancelTicket = ticket.created_by_id === user.id && ticket.status === 'created'

  const isAssignedTechnician = isTechnician && ticket.assigned_to_id === user.id
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
      fetchTimeline()
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
      fetchTimeline()
    } catch (err: any) {
      setManageError(err.message || 'Something went wrong.')
    } finally {
      setUpdatingPriority(false)
    }
  }

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
      fetchTimeline()
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
      fetchTimeline()
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
      fetchTimeline()
    } catch (err: any) {
      setRatingError(err.message || 'Something went wrong.')
    } finally {
      setSubmittingRating(false)
    }
  }

  async function handleAcceptAssignment() {
    if (!ticket) return
    setResponding(true)
    setRespondError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/interventions/assignments/${ticket.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to accept assignment.')
      fetchTicket()
      fetchTimeline()
    } catch (err: any) {
      setRespondError(err.message || 'Something went wrong.')
    } finally {
      setResponding(false)
    }
  }

  async function handleRejectAssignment() {
    if (!ticket) return
    setResponding(true)
    setRespondError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/interventions/assignments/${ticket.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reject assignment.')
      setShowRejectForm(false)
      setRejectReason('')
      fetchTicket()
      fetchTimeline()
    } catch (err: any) {
      setRespondError(err.message || 'Something went wrong.')
    } finally {
      setResponding(false)
    }
  }

  // FIXED: no more window.confirm(). Button opens `showCancelDialog`;
  // the API call fires only after the user confirms in <ConfirmDialog />.
  async function handleCancelTicket() {
    if (!ticket) return
    setCancelling(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${ticket.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel ticket.')
      setShowCancelDialog(false)
      fetchTicket()
      fetchTimeline()
    } catch (err: any) {
      alert(err.message || 'Something went wrong.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Centered Header */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col items-center text-center space-y-5 relative">
        <button
          onClick={() => router.back()}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">#{ticket.id}</span>
          <CategoryBadge category={ticket.category} />
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-foreground text-balance max-w-2xl">{ticket.title}</h1>
        
        {(canEditTicket || canCancelTicket) && !editing && (
          <div className="flex items-center justify-center gap-3 pt-2">
            {canEditTicket && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit Ticket
              </button>
            )}
            {canCancelTicket && (
              <button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" /> {cancelling ? 'Cancelling…' : 'Cancel Ticket'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata Overview Grid (Horizontal, Centered feel) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {ticket.created_by_name ? getInitials(ticket.created_by_name.split(' ')[0], ticket.created_by_name.split(' ')[1] || '') : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Requester</p>
            <p className="text-sm font-semibold text-foreground truncate">{ticket.created_by_name || 'Unknown'}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 font-bold">
            {ticket.assigned_to_name ? getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '') : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</p>
            <p className="text-sm font-semibold text-foreground truncate">{ticket.assigned_to_name || 'Unassigned'}</p>
            {canManage && techRating && techRating.rating_count > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">{techRating.avg_rating}</span>
                <span>({techRating.rating_count})</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Timeline</span>
          </div>
          <p className="text-xs font-medium text-foreground"><span className="text-muted-foreground">Created:</span> {formatDateTime(ticket.created_at)}</p>
          <p className="text-xs font-medium text-foreground"><span className="text-muted-foreground">Updated:</span> {formatDateTime(ticket.updated_at)}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        
        {/* Description */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8">
          {!editing ? (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Description
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Edit Ticket</h2>
                <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && <p className="text-xs text-destructive">{editError}</p>}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Title</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  maxLength={120}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Category</label>
                  <select
                    value={editCat}
                    onChange={e => setEditCat(e.target.value as TicketCategory)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Priority</label>
                  <select
                    value={editPrio}
                    onChange={e => setEditPrio(e.target.value as TicketPriority)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim() || !editDesc.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Management & Action Bar (Centralized) */}
        {canManage && (
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-3">
              <Wrench className="w-4 h-4 text-primary" /> Management Actions
            </h2>
            
            {manageError && <p className="text-xs text-destructive">{manageError}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign Technician</label>
                {ticket.status === 'pending_assignment' ? (
                  <p className="text-sm font-medium text-amber-600 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/20">
                    Awaiting response from {ticket.assigned_to_name}
                  </p>
                ) : (
                  <TechnicianSelect
                    technicians={technicians}
                    value={ticket.assigned_to_id}
                    disabled={assigning}
                    placeholder="Select Technician…"
                    onSelect={handleAssign}
                  />
                )}
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Update Status</label>
                <div className="flex flex-wrap gap-2">
                  {visibleNextStatuses.length > 0 ? visibleNextStatuses.map(ns => (
                    <button
                      key={ns}
                      onClick={() => handleStatusChange(ns)}
                      disabled={updatingStatus}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {updatingStatus ? 'Updating…' : `Mark ${ns.replace('_', ' ')}`}
                    </button>
                  )) : (
                    <p className="text-sm font-medium text-muted-foreground px-4 py-3 bg-muted/30 rounded-xl w-full text-center border border-transparent">
                      No further transitions
                    </p>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Update Priority</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      disabled={updatingPriority || p === ticket.priority}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize',
                        p === ticket.priority
                          ? 'bg-foreground text-background shadow-md'
                          : 'bg-muted/50 text-muted-foreground border border-border/50 hover:border-border hover:text-foreground disabled:opacity-60'
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

        {/* Technician Action Banner */}
        {isTechnician && ticket.assigned_to_id === user.id && ticket.status === 'pending_assignment' && (
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-3xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-foreground">New Assignment — Action Required</h2>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              You've been assigned this ticket. Accept it to begin work, or reject it so it can be reassigned.
            </p>
            {respondError && <p className="text-sm font-semibold text-destructive bg-destructive/10 px-4 py-2 rounded-lg">{respondError}</p>}

            {!showRejectForm ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAcceptAssignment}
                  disabled={responding}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-60 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" /> {responding ? 'Accepting…' : 'Accept Assignment'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={responding}
                  className="flex items-center gap-2 px-6 py-3 border border-destructive/30 text-destructive rounded-xl text-sm font-bold hover:bg-destructive/10 transition-colors disabled:opacity-60"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-background p-4 rounded-2xl border border-border">
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Optional reason (e.g. out of zone, overloaded)…"
                  rows={2}
                  className="w-full bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
                />
                <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                  <button
                    onClick={handleRejectAssignment}
                    disabled={responding}
                    className="px-5 py-2.5 bg-destructive text-white rounded-xl text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-60"
                  >
                    {responding ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                    className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAssignedTechnician && ticket.status !== 'pending_assignment' && (
          <Link
            href="/interventions"
            className="group flex flex-col sm:flex-row items-center gap-4 bg-primary text-primary-foreground rounded-3xl p-6 md:p-8 hover:bg-primary/90 transition-all shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-lg font-bold">Update your intervention</p>
              <p className="text-sm font-medium text-white/80 mt-1">
                Log status (traveling / in progress / completed) and your closing report from the Interventions page.
              </p>
            </div>
            <ArrowRight className="w-5 h-5 ml-auto hidden sm:block opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        )}

        {/* Ratings block */}
        {ticket.created_by_id === user.id && ['resolved', 'closed'].includes(ticket.status) && ticket.assigned_to_id && (
          <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              {ticket.employee_rating ? 'Your Rating' : 'Rate the Technician'}
            </h2>

            {ticket.employee_rating ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star
                      key={n}
                      className={cn(
                        'w-6 h-6',
                        n <= (ticket.employee_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                      )}
                    />
                  ))}
                </div>
                {ticket.rating_comment && (
                  <p className="text-sm text-foreground bg-muted/40 rounded-xl p-4 border border-border/50">
                    {ticket.rating_comment}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">
                  How was your experience with {ticket.assigned_to_name || 'the technician'} on this ticket?
                </p>
                {ratingError && <p className="text-xs font-semibold text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{ratingError}</p>}
                
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingValue(n)}
                      onMouseEnter={() => setRatingHover(n)}
                      onMouseLeave={() => setRatingHover(0)}
                      className="p-1 hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star
                        className={cn(
                          'w-8 h-8 transition-colors',
                          n <= (ratingHover || ratingValue) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-400/50'
                        )}
                      />
                    </button>
                  ))}
                </div>
                
                <textarea
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  placeholder="Optional feedback..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                
                <button
                  onClick={handleSubmitRating}
                  disabled={ratingValue < 1 || submittingRating}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Star className="w-4 h-4" />
                  {submittingRating ? 'Submitting…' : 'Submit Rating'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Timeline Component */}
        <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="px-6 md:px-8 py-5 border-b border-border/50 flex items-center gap-2 bg-muted/20">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Timeline Progress</h2>
          </div>

          <div className="p-6 md:p-8">
            {timelineLoading && <p className="text-sm font-medium text-muted-foreground text-center py-4">Loading timeline…</p>}
            {!timelineLoading && timelineError && <p className="text-sm font-medium text-destructive text-center py-4">{timelineError}</p>}
            {!timelineLoading && !timelineError && (
              <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
                <div className="min-w-max px-2">
                   <SimpleTimeline entries={timeline} currentStatus={ticket.status} ticket={ticket} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="px-6 md:px-8 py-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Conversation</h2>
            </div>
            <span className="text-xs font-bold bg-background text-muted-foreground px-2.5 py-1 rounded-full border border-border/50">
              {ticket.comments?.length || 0} messages
            </span>
          </div>

          <div className="divide-y divide-border/50">
            {(!ticket.comments || ticket.comments.length === 0) && (
              <div className="text-center py-12 px-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Comments and updates will appear here.</p>
              </div>
            )}
            {ticket.comments?.map(c => (
              <div key={c.id} className={cn(
                'px-6 md:px-8 py-6 flex gap-4 transition-colors',
                c.is_internal ? 'bg-amber-500/5' : 'hover:bg-muted/10'
              )}>
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {c.user_name ? getInitials(c.user_name.split(' ')[0], c.user_name.split(' ')[1] || '') : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{c.user_name || 'Unknown'}</span>
                      {c.user_role && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {ROLE_LABELS[c.user_role as keyof typeof ROLE_LABELS] || c.user_role}
                        </span>
                      )}
                      {!!c.is_internal && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5">
                          <Lock className="w-3 h-3" /> Internal Note
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          {canComment && (
            <div className="p-6 md:p-8 bg-muted/10 border-t border-border/50">
              <form onSubmit={handleSendComment} className="space-y-4">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Leave a comment or update…"
                  rows={3}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none shadow-sm"
                />
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {['admin','support_agent'].includes(user.role) ? (
                    <label className="flex items-center gap-2.5 text-sm font-medium text-foreground cursor-pointer select-none">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={e => setIsInternal(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 rounded border border-border peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-muted-foreground peer-checked:text-foreground transition-colors">Internal note only</span>
                      </div>
                    </label>
                  ) : <div />}
                  
                  <button
                    type="submit"
                    disabled={!comment.trim() || posting}
                    className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60 shadow-sm hover:shadow active:scale-95"
                  >
                    <Send className="w-4 h-4" /> {posting ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showCancelDialog}
        title="Cancel this ticket?"
        description="This action cannot be undone. The ticket will be permanently cancelled."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep ticket"
        variant="danger"
        loading={cancelling}
        onConfirm={handleCancelTicket}
        onCancel={() => setShowCancelDialog(false)}
      />
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

const STAGE_BADGE_COLOR: Record<string, string> = {
  created:            'bg-blue-500/15 text-blue-400',
  pending_assignment: 'bg-orange-500/15 text-orange-400',
  assigned:           'bg-green-500/15 text-green-400',
  in_progress:        'bg-amber-500/15 text-amber-400',
  resolved:           'bg-emerald-500/15 text-emerald-500',
}

const STAGE_STAGGER = [0, 56, 0, 56, 0]

function SimpleTimeline({
  entries, currentStatus, ticket,
}: {
  entries: TimelineEntry[]
  currentStatus: TicketStatus
  ticket: Ticket
}) {
  const CARD_WIDTH = 190
  const GAP = 56

  const STAGE_NAME_OVERRIDE: Partial<Record<TicketStatus, string | undefined>> = {
    created:            ticket.created_by_name,
    pending_assignment: ticket.assigned_to_name,
    assigned:           ticket.assigned_to_name,
  }

  const lastRejection = [...entries].reverse().find(e => e.action === 'REJECT_ASSIGNMENT')

  const stageEntries = STAGES.map(stage => {
    const match = entries.find(e => stage.actions.includes(e.action))
    return { ...stage, entry: match, displayName: STAGE_NAME_OVERRIDE[stage.key] ?? match?.user_name }
  })

  const effectiveStatus = currentStatus === 'closed' ? 'resolved' : currentStatus
  const currentIndex = currentStatus === 'cancelled'
    ? 0
    : STATUS_ORDER.indexOf(effectiveStatus as typeof STATUS_ORDER[number])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div
          className="relative"
          style={{
            width: stageEntries.length * (CARD_WIDTH + GAP),
            height: Math.max(...STAGE_STAGGER) + 130,
          }}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {stageEntries.slice(0, -1).map((_, i) => {
              const x1 = i * (CARD_WIDTH + GAP) + CARD_WIDTH
              const y1 = STAGE_STAGGER[i % STAGE_STAGGER.length] + 20
              const x2 = (i + 1) * (CARD_WIDTH + GAP)
              const y2 = STAGE_STAGGER[(i + 1) % STAGE_STAGGER.length] + 20
              const midX = (x1 + x2) / 2
              const reached = i < currentIndex
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={reached ? 'var(--color-primary, #6366f1)' : '#f5c451'}
                  strokeWidth={2}
                  opacity={reached ? 1 : 0.5}
                />
              )
            })}
          </svg>

          {stageEntries.map((stage, i) => {
            const done = i <= currentIndex
            const top = STAGE_STAGGER[i % STAGE_STAGGER.length]
            const badgeColor = STAGE_BADGE_COLOR[stage.key] || 'bg-muted text-muted-foreground'

            return (
              <div
                key={stage.key}
                className="absolute"
                style={{ left: i * (CARD_WIDTH + GAP), top, width: CARD_WIDTH }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full shrink-0 border-2 transition-colors',
                      done
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground'
                    )}
                  >
                    {stage.icon}
                  </span>
                  {stage.entry && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(stage.entry.created_at)}
                    </span>
                  )}
                </div>

                <div className={cn(
                  'bg-card border rounded-lg px-3 py-2.5 shadow-sm space-y-1.5 transition-colors',
                  done ? 'border-border' : 'border-border/50 opacity-60'
                )}>
                  <p className="text-xs font-semibold text-foreground truncate">{stage.label}</p>
                  <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full', badgeColor)}>
                    {stage.displayName ? stage.displayName : done ? 'Reached' : 'Pending'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {currentStatus === 'cancelled' && (
        <p className="text-xs text-destructive">This ticket was cancelled before it progressed further.</p>
      )}

      {currentStatus === 'created' && lastRejection && (
        <p className="text-xs text-orange-400">
          Previous assignment was declined by {lastRejection.user_name}
          {lastRejection.details ? ` — ${lastRejection.details.replace(/^Technician declined:?\s*/i, '')}` : ''}.
          Ready to reassign.
        </p>
      )}
    </div>
  )
}