'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Clock, MessageSquare,
  Lock, Send, AlertTriangle, Pencil, X, Save, CheckCircle2, Wrench, Star,
  History, PlusCircle, UserCheck, FileText, UserPlus, Users, Check, RotateCcw, RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TechnicianSelect } from '@/components/technician-select'
import AttachmentsPanel from '@/components/attachments-panel'
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

  const [showReopenDialog, setShowReopenDialog]   = useState(false)
  const [reopenReason, setReopenReason]         = useState('')
  const [reopening, setReopening]                 = useState(false)
  const [reopenError, setReopenError]             = useState('')
  const [showExpiredDialog, setShowExpiredDialog] = useState(false)
  const [closingTicket, setClosingTicket]         = useState(false)

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

  function handleReopenClick() {
    if (!ticket?.resolved_at) {
      setShowReopenDialog(true)
      return
    }
    const resolvedTime = new Date(ticket.resolved_at).getTime()
    const hoursSinceResolved = (Date.now() - resolvedTime) / (1000 * 60 * 60)

    if (hoursSinceResolved > 24) {
      setShowExpiredDialog(true)
    } else {
      setShowReopenDialog(true)
    }
  }

  async function handleReopenTicket() {
    if (!ticket || !reopenReason.trim()) {
      setReopenError('Please provide a reason for reopening.')
      return
    }
    setReopening(true)
    setReopenError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${ticket.id}/reopen`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reopen ticket.')
      setShowReopenDialog(false)
      setReopenReason('')
      fetchTicket()
      fetchTimeline()
    } catch (err: any) {
      setReopenError(err.message || 'Something went wrong.')
    } finally {
      setReopening(false)
    }
  }

  async function handleConfirmResolution() {
    if (!ticket) return
    setClosingTicket(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:4000/api/tickets/${ticket.id}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close ticket.')
      fetchTicket()
      fetchTimeline()
    } catch (err: any) {
      alert(err.message || 'Something went wrong.')
    } finally {
      setClosingTicket(false)
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-20 space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4 flex-1">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors bg-muted/40 px-3 py-1.5 rounded-xl w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-black text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">#{ticket.id}</span>
            <CategoryBadge category={ticket.category} />
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>

          <h1 className="text-2xl md:text-4xl font-black text-foreground text-balance leading-tight">{ticket.title}</h1>
        </div>

        {(canEditTicket || canCancelTicket) && !editing && (
          <div className="flex items-center gap-3 shrink-0 pt-4 md:pt-10">
            {canEditTicket && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-glow transition-all duration-300"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
            {canCancelTicket && (
              <button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/20 hover:shadow-glow transition-all duration-300 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> {cancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT COLUMN: Main Content Flow */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Resolution Prompt */}
          {ticket.status === 'resolved' && user.id === ticket.created_by_id && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 md:p-8 space-y-5 shadow-soft">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-foreground">Technician resolved this ticket</h3>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    Your ticket has been marked as resolved. Please confirm if your problem is completely fixed, or reopen if you still need assistance.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleConfirmResolution}
                  disabled={closingTicket}
                  className="w-full sm:w-auto flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-glow disabled:opacity-60"
                >
                  <Check className="w-4 h-4" /> {closingTicket ? 'Closing…' : 'Yes, Problem Solved'}
                </button>
                <button
                  onClick={handleReopenClick}
                  className="w-full sm:w-auto flex-1 py-3 px-5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all border border-rose-500/20 shadow-sm hover:shadow-glow"
                >
                  <RotateCcw className="w-4 h-4" /> No, Reopen Ticket
                </button>
              </div>
            </div>
          )}

          {/* Technician Action Banner */}
          {isTechnician && ticket.assigned_to_id === user.id && ticket.status === 'pending_assignment' && (
            <div className="bg-amber-500/5 border border-amber-500/30 shadow-soft rounded-3xl p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-black text-foreground">New Assignment — Action Required</h2>
              </div>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                You've been assigned this ticket. Accept it to begin work, or reject it so it can be reassigned.
              </p>
              {respondError && <p className="text-sm font-semibold text-destructive bg-destructive/10 px-4 py-2 rounded-xl">{respondError}</p>}

              {!showRejectForm ? (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleAcceptAssignment}
                    disabled={responding}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-60 shadow-sm hover:shadow-glow"
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
                <div className="space-y-3 bg-background p-5 rounded-2xl border border-border shadow-inner mt-4">
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Optional reason (e.g. out of zone, overloaded)…"
                    rows={2}
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
                  />
                  <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                    <button
                      onClick={handleRejectAssignment}
                      disabled={responding}
                      className="px-5 py-2.5 bg-destructive text-white rounded-xl text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-60 shadow-sm"
                    >
                      {responding ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                      className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground bg-muted/30 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl p-6 md:p-8">
            {!editing ? (
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Description
                </h2>
                <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-foreground">Edit Ticket</h2>
                  <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground bg-muted/50 p-1.5 rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {editError && <p className="text-xs font-bold text-destructive bg-destructive/10 px-4 py-2.5 rounded-xl">{editError}</p>}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Title</label>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={120}
                    className="w-full px-4 py-3 bg-background border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-border/50 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</label>
                    <select
                      value={editCat}
                      onChange={e => setEditCat(e.target.value as TicketCategory)}
                      className="w-full px-4 py-3 bg-background border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                    <select
                      value={editPrio}
                      onChange={e => setEditPrio(e.target.value as TicketPriority)}
                      className="w-full px-4 py-3 bg-background border border-border/50 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-3 border border-border/50 rounded-2xl text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editTitle.trim() || !editDesc.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-black shadow-glow hover:bg-primary/90 transition-all disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tech intervention shortcut */}
          {isAssignedTechnician && ticket.status !== 'pending_assignment' && (
            <Link
              href="/interventions"
              className="group flex flex-col sm:flex-row items-center gap-4 bg-primary text-primary-foreground rounded-3xl p-6 hover:bg-primary/90 transition-all shadow-glow hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-lg font-black">Update your intervention</p>
                <p className="text-sm font-semibold text-white/80 mt-1">
                  Log status (traveling / in progress / completed) and your closing report from the Interventions page.
                </p>
              </div>
              <ArrowRight className="w-6 h-6 ml-auto hidden sm:block opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          )}

          {/* Timeline */}
          <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-border/20 flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black text-muted-foreground uppercase tracking-wider">Timeline</h2>
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

          {/* Attachments */}
          <AttachmentsPanel
            ticketId={ticket.id}
            canUpload={
              user.role === 'admin' ||
              user.role === 'support_agent' ||
              (user.role === 'employee' && ticket.created_by_id === user.id) ||
              (user.role === 'technician' && ticket.assigned_to_id === user.id)
            }
          />

          {/* Conversation */}
          <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-black text-muted-foreground uppercase tracking-wider">Conversation</h2>
              </div>
              <span className="text-xs font-bold bg-muted text-muted-foreground px-3 py-1 rounded-full">
                {ticket.comments?.length || 0} messages
              </span>
            </div>

            <div className="divide-y divide-border/20">
              {(!ticket.comments || ticket.comments.length === 0) && (
                <div className="text-center py-12 px-6">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-bold text-foreground">No activity yet</p>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Comments and updates will appear here.</p>
                </div>
              )}
              {ticket.comments?.map(c => (
                <div key={c.id} className={cn(
                  'px-6 md:px-8 py-6 flex gap-4 transition-colors',
                  c.is_internal ? 'bg-amber-500/5' : 'hover:bg-muted/10'
                )}>
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0 shadow-inner">
                    {c.user_name ? getInitials(c.user_name.split(' ')[0], c.user_name.split(' ')[1] || '') : '?'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-foreground">{c.user_name || 'Unknown'}</span>
                        {c.user_role && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                            {ROLE_LABELS[c.user_role as keyof typeof ROLE_LABELS] || c.user_role}
                          </span>
                        )}
                        {!!c.is_internal && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-500/10 rounded-md px-2 py-0.5 shadow-sm">
                            <Lock className="w-3 h-3" /> Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {canComment && (
              <div className="p-6 md:p-8 bg-muted/10 border-t border-border/20">
                <form onSubmit={handleSendComment} className="space-y-4">
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Leave a comment or update…"
                    rows={3}
                    className="w-full bg-background border border-border/50 rounded-2xl px-5 py-4 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none shadow-inner"
                  />
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {['admin','support_agent'].includes(user.role) ? (
                      <label className="flex items-center gap-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={e => setIsInternal(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="w-5 h-5 rounded-lg border-2 border-muted-foreground/40 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        Internal note only
                      </label>
                    ) : <div />}
                    
                    <button
                      type="submit"
                      disabled={!comment.trim() || posting}
                      className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-black px-6 py-3 rounded-2xl shadow-glow hover:bg-primary/90 transition-all disabled:opacity-60 active:scale-95"
                    >
                      <Send className="w-4 h-4" /> {posting ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Metadata & Actions) */}
        <div className="space-y-6 lg:sticky lg:top-8">
          
          {/* Metadata Card */}
          <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl p-6 space-y-6">
            <h2 className="text-sm font-black text-muted-foreground uppercase tracking-wider mb-4 border-b border-border/20 pb-3">
              Details
            </h2>
            
            <div className="space-y-5">
              {/* Requester */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0 shadow-inner">
                  {ticket.created_by_name ? getInitials(ticket.created_by_name.split(' ')[0], ticket.created_by_name.split(' ')[1] || '') : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Requester</p>
                  <p className="text-sm font-bold text-foreground truncate">{ticket.created_by_name || 'Unknown'}</p>
                </div>
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600 font-black shrink-0 shadow-inner">
                  {ticket.assigned_to_name ? getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '') : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Assigned To</p>
                  <p className="text-sm font-bold text-foreground truncate">{ticket.assigned_to_name || 'Unassigned'}</p>
                  {canManage && techRating && techRating.rating_count > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-foreground">{techRating.avg_rating}</span>
                      <span className="font-medium">({techRating.rating_count})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="pt-2 border-t border-border/20 space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground"><span className="text-muted-foreground font-medium">Created:</span> {formatDateTime(ticket.created_at)}</p>
                    <p className="text-xs font-semibold text-foreground"><span className="text-muted-foreground font-medium">Updated:</span> {formatDateTime(ticket.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Management Actions */}
          {canManage && (
            <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl p-6 space-y-5">
              <h2 className="text-sm font-black text-primary uppercase tracking-wider border-b border-border/20 pb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Manage
              </h2>
              
              {manageError && <p className="text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{manageError}</p>}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Assign Technician</label>
                  {ticket.status === 'pending_assignment' ? (
                    <p className="text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-2.5 rounded-xl border border-amber-500/20 leading-tight">
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

                <div className="space-y-2 pt-2 border-t border-border/20">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Update Status</label>
                  <div className="flex flex-col gap-2">
                    {visibleNextStatuses.length > 0 ? visibleNextStatuses.map(ns => (
                      <button
                        key={ns}
                        onClick={() => handleStatusChange(ns)}
                        disabled={updatingStatus}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-black rounded-2xl shadow-glow hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {updatingStatus ? 'Updating…' : `Mark ${ns.replace('_', ' ')}`}
                      </button>
                    )) : (
                      <p className="text-xs font-bold text-muted-foreground px-4 py-3 bg-muted/40 rounded-2xl w-full text-center">
                        No further transitions
                      </p>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="space-y-2 pt-2 border-t border-border/20">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Update Priority</label>
                    <div className="flex flex-wrap gap-2">
                      {PRIORITIES.map(p => (
                        <button
                          key={p}
                          onClick={() => handlePriorityChange(p)}
                          disabled={updatingPriority || p === ticket.priority}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize shadow-sm',
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
            </div>
          )}

          {/* Ratings */}
          {ticket.created_by_id === user.id && ['resolved', 'closed'].includes(ticket.status) && ticket.assigned_to_id && (
            <div className="bg-card/80 backdrop-blur-sm border border-amber-500/20 rounded-3xl p-6 shadow-glow space-y-4">
              <h2 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2 border-b border-amber-500/20 pb-3">
                <Star className="w-4 h-4" />
                {ticket.employee_rating ? 'Your Rating' : 'Rate Technician'}
              </h2>

              {ticket.employee_rating ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 justify-center">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={cn(
                          'w-6 h-6',
                          n <= (ticket.employee_rating || 0) ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-border/50'
                        )}
                      />
                    ))}
                  </div>
                  {ticket.rating_comment && (
                    <p className="text-sm font-medium text-foreground bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 text-center">
                      "{ticket.rating_comment}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">
                    How was your experience with {ticket.assigned_to_name || 'the technician'}?
                  </p>
                  {ratingError && <p className="text-xs font-bold text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{ratingError}</p>}
                  
                  <div className="flex items-center justify-center gap-2">
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
                            n <= (ratingHover || ratingValue) ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-border/50 hover:text-amber-400/50'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  
                  <textarea
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    placeholder="Optional feedback..."
                    rows={2}
                    className="w-full bg-background border border-border/50 rounded-2xl px-4 py-3 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none shadow-inner"
                  />
                  
                  <button
                    onClick={handleSubmitRating}
                    disabled={ratingValue < 1 || submittingRating}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl text-sm font-black hover:bg-amber-600 transition-colors disabled:opacity-60 shadow-md"
                  >
                    <Star className="w-4 h-4" />
                    {submittingRating ? 'Submitting…' : 'Submit Rating'}
                  </button>
                </div>
              )}
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

      {/* Reopen Reason Modal */}
      {showReopenDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowReopenDialog(false)} />
          <div className="relative z-10 bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5">
            <button
              onClick={() => setShowReopenDialog(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">Reopen Ticket #{ticket.id}</h2>
                <p className="text-xs text-muted-foreground">
                  Please explain why the resolution didn't fix your issue. This helps agents & technicians resolve it faster.
                </p>
              </div>
            </div>

            {reopenError && (
              <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
                {reopenError}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Why are you reopening this ticket? <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={e => setReopenReason(e.target.value)}
                placeholder="Describe what is still not working or what went wrong…"
                rows={4}
                required
                className="w-full bg-background border border-border rounded-2xl p-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenDialog(false)}
                className="flex-1 py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopenTicket}
                disabled={reopening || !reopenReason.trim()}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-xs"
              >
                <RotateCcw className="w-4 h-4" /> {reopening ? 'Reopening…' : 'Reopen Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Expired Dialog */}
      {showExpiredDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowExpiredDialog(false)} />
          <div className="relative z-10 bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 space-y-5">
            <button
              onClick={() => setShowExpiredDialog(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">24-Hour Limit Reached</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  This ticket was resolved more than 24 hours ago and can no longer be reopened. To ensure proper history tracking, please submit a new ticket instead.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExpiredDialog(false)}
                className="flex-1 py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors"
              >
                Close
              </button>
              <Link
                href="/tickets/new"
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" /> Create New Ticket
              </Link>
            </div>
          </div>
        </div>
      )}
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