'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  SlidersHorizontal,
  X,
  AlertCircle,
  CheckSquare,
  Square,
  UserPlus,
  ArrowRight,
  Check,
  Inbox,
  ShieldAlert,
  Clock,
  Sparkles,
  Ban,
  CheckCircle2,
  Users
} from 'lucide-react'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { timeAgo, getInitials, CATEGORY_LABELS, STATUS_LABELS } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type Ticket = {
  id: number
  title: string
  category: string
  priority: string
  status: string
  created_at: string
  resolved_at?: string | null
  created_by_name?: string
  assigned_to_name?: string
  assigned_to_id?: number | null
}

type Technician = { id: number; first_name: string; last_name: string }

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: TicketStatus[] = ['created', 'pending_assignment' as TicketStatus, 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled']

const SLA_HOURS: Record<string, number> = { critical: 4, high: 24, medium: 72, low: 168 }

function isOverdue(t: Ticket): boolean {
  if (['resolved', 'closed', 'cancelled'].includes(t.status)) return false
  const limit = SLA_HOURS[t.priority] ?? 168
  const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 36e5
  return ageHours > limit
}

const NEXT_STATUS: Record<string, TicketStatus | null> = {
  created: null,
  pending_assignment: null,
  assigned: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
  closed: null,
  cancelled: null,
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

export default function TicketsPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const [technicians, setTechnicians] = useState<Technician[]>([])

  // Filters
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [category, setCategory] = useState<string>('')

  // Single Assign
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [assignTechId, setAssignTechId] = useState<string>('')
  const [busyId, setBusyId] = useState<number | null>(null)

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [bulkAssignTechId, setBulkAssignTechId] = useState('')

  const hasActiveFilters = !!(status || priority || category)

  useEffect(() => {
    if (!user || !['admin', 'support_agent'].includes(user.role)) return
    const fetchTechnicians = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/users?role=technician&is_active=true', { headers: authHeaders() })
        const data = await res.json()
        if (res.ok) setTechnicians(Array.isArray(data) ? data : data.data || [])
      } catch {
        // silent fail
      }
    }
    fetchTechnicians()
  }, [user])

  async function fetchTickets() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (priority) params.set('priority', priority)
      if (category) params.set('category', category)

      const qs = params.toString()
      const res = await fetch(`http://localhost:4000/api/tickets${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets.')
      setTickets(data.data || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, category])

  useEffect(() => {
    setSelected(new Set())
  }, [tickets.length, status, priority, category])

  function clearFilters() {
    setStatus('')
    setPriority('')
    setCategory('')
  }

  async function handleAssign(ticketId: number) {
    if (!assignTechId) return
    setBusyId(ticketId)
    setActionError('')
    try {
      const res = await fetch('http://localhost:4000/api/interventions', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, technician_id: Number(assignTechId) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign ticket.')
      setAssigningId(null)
      setAssignTechId('')
      await fetchTickets()
    } catch (err: any) {
      setActionError(err.message || 'Failed to assign ticket.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleStatusChange(ticketId: number, nextStatus: TicketStatus) {
    setBusyId(ticketId)
    setActionError('')
    try {
      const res = await fetch(`http://localhost:4000/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update ticket.')
      await fetchTickets()
    } catch (err: any) {
      setActionError(err.message || 'Failed to update ticket.')
    } finally {
      setBusyId(null)
    }
  }

  function toggleSelected(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === tickets.length ? new Set() : new Set(tickets.map(t => t.id)))
  }

  const selectedTickets = tickets.filter(t => selected.has(t.id))
  const allSelectedAreCreatedUnassigned = selectedTickets.length > 0 &&
    selectedTickets.every(t => t.status === 'created' && !t.assigned_to_id)
  const allSelectedAreResolved = selectedTickets.length > 0 &&
    selectedTickets.every(t => t.status === 'resolved')
  const allSelectedAreCreated = selectedTickets.length > 0 &&
    selectedTickets.every(t => t.status === 'created')

  async function handleBulkAssign() {
    if (!bulkAssignTechId || selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await fetch('http://localhost:4000/api/interventions/bulk-assign', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_ids: [...selected], technician_id: Number(bulkAssignTechId) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk assign failed.')
      const failed = (data.results || []).filter((r: any) => !r.ok)
      if (failed.length) {
        setBulkError(`${failed.length} ticket(s) couldn't be assigned: ${failed.map((f: any) => `#${f.id} (${f.error})`).join(', ')}`)
      }
      setShowBulkAssign(false)
      setBulkAssignTechId('')
      setSelected(new Set())
      await fetchTickets()
    } catch (err: any) {
      setBulkError(err.message || 'Bulk assign failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkStatus(newStatus: 'closed' | 'cancelled') {
    if (selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await fetch('http://localhost:4000/api/tickets/bulk', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_ids: [...selected], status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk update failed.')
      const failed = (data.results || []).filter((r: any) => !r.ok)
      if (failed.length) {
        setBulkError(`${failed.length} ticket(s) skipped: ${failed.map((f: any) => `#${f.id} (${f.error})`).join(', ')}`)
      }
      setSelected(new Set())
      await fetchTickets()
    } catch (err: any) {
      setBulkError(err.message || 'Bulk update failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkPriority(newPriority: TicketPriority) {
    if (selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const res = await fetch('http://localhost:4000/api/tickets/bulk', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_ids: [...selected], priority: newPriority }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk update failed.')
      setSelected(new Set())
      await fetchTickets()
    } catch (err: any) {
      setBulkError(err.message || 'Bulk update failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  const isTechnician = user?.role === 'technician'
  const isAdmin = user?.role === 'admin'
  const canCreate = user ? ['admin', 'support_agent', 'employee'].includes(user.role) : false
  const canFilter = user ? ['admin', 'support_agent'].includes(user.role) : false
  const canAct = user ? ['admin', 'support_agent'].includes(user.role) : false
  const canBulk = canAct

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isTechnician ? 'My Assigned Tickets' : 'Ticket Queue'}
            </h1>
            {!loading && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isTechnician ? 'Manage and update support requests assigned directly to you.' : 'Overview and manage all internal tickets.'}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-95 shadow-sm hover:shadow transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Create Ticket
          </Link>
        )}
      </div>

      {/* Filter Toolbar */}
      {canFilter && (
        <div className="mb-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Pill Tabs for Status */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/50 rounded-full overflow-x-auto max-w-full hide-scrollbar shadow-inner">
              <button
                onClick={() => setStatus('')}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  status === '' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                All Requests
              </button>
              {['created', 'pending_assignment', 'in_progress', 'resolved'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200",
                    status === s ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {STATUS_LABELS[s as TicketStatus] || s}
                </button>
              ))}
            </div>

            {/* Secondary Filters */}
            <div className="flex items-center gap-3">
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="px-4 py-2 bg-background border border-border/60 rounded-full text-xs font-semibold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:text-foreground transition-all duration-150 appearance-none capitalize shadow-sm hover:border-border"
              >
                <option value="">Priority: All</option>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="px-4 py-2 bg-background border border-border/60 rounded-full text-xs font-semibold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:text-foreground transition-all duration-150 appearance-none shadow-sm hover:border-border"
              >
                <option value="">Category: All</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {canBulk && selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {selected.size}
            </span>
            <span className="text-sm font-semibold text-foreground">Items selected</span>
          </div>

          {bulkError && <p className="text-xs font-medium text-destructive basis-full">{bulkError}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            {allSelectedAreCreatedUnassigned && (
              showBulkAssign ? (
                <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border">
                  <select
                    value={bulkAssignTechId}
                    onChange={e => setBulkAssignTechId(e.target.value)}
                    className="px-2.5 py-1 bg-transparent text-xs font-medium focus:outline-none"
                  >
                    <option value="">Choose technician…</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!bulkAssignTechId || bulkBusy}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {bulkBusy ? 'Assigning…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => { setShowBulkAssign(false); setBulkAssignTechId('') }}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkAssign(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 shadow-2xs transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign Selected
                </button>
              )
            )}

            {allSelectedAreResolved && (
              <button
                onClick={() => handleBulkStatus('closed')}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-2xs transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {bulkBusy ? 'Closing…' : 'Mark Closed'}
              </button>
            )}

            {allSelectedAreCreated && (
              <button
                onClick={() => handleBulkStatus('cancelled')}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold hover:bg-rose-100 shadow-2xs transition-all disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" /> {bulkBusy ? 'Cancelling…' : 'Cancel Requests'}
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-background/80 px-2 py-1 rounded-xl border border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">Priority:</span>
                {PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => handleBulkPriority(p)}
                    disabled={bulkBusy}
                    className="px-2 py-0.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-accent text-foreground transition-colors capitalize disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 ml-2"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      {/* Main List View */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-12 text-center text-muted-foreground space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Loading ticket queue…</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-16 text-center">
            <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
              <Inbox className="w-10 h-10 stroke-1 opacity-50" />
              <p className="text-sm font-semibold text-foreground">No tickets found</p>
              <p className="text-xs">
                {hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'There are currently no tickets available.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tickets.map(ticket => {
              const overdue = isOverdue(ticket)
              const nextStatus = NEXT_STATUS[ticket.status] ?? null
              const isSelected = selected.has(ticket.id)

              return (
                <div
                  key={ticket.id}
                  className={cn(
                    "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card rounded-2xl border transition-all duration-200",
                    isSelected
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : overdue
                      ? "border-rose-200 bg-rose-50/30 hover:border-rose-300"
                      : "border-border/60 hover:border-primary/30 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {canBulk && (
                      <button
                        onClick={() => toggleSelected(ticket.id)}
                        className="mt-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    )}

                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-medium text-muted-foreground">#{ticket.id}</span>
                        <CategoryBadge category={ticket.category as any} size="sm" />
                        <PriorityBadge priority={ticket.priority as any} size="sm" />
                        <StatusBadge status={ticket.status as any} size="sm" />
                        {overdue && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-md">
                            <Clock className="w-3 h-3 text-rose-600" /> Overdue
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-base font-bold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {ticket.title}
                      </Link>

                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mt-1">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {timeAgo(ticket.created_at)}
                        </span>
                        {!isTechnician && (
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {ticket.assigned_to_name ? (
                              <span className="text-foreground">
                                {ticket.assigned_to_name}
                                {ticket.status === 'pending_assignment' && <span className="text-amber-600"> (pending)</span>}
                              </span>
                            ) : (
                              <span className="italic">Unassigned</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex flex-row sm:flex-col items-end justify-end gap-2 shrink-0">
                      {!ticket.assigned_to_id && ticket.status === 'created' && (
                        assigningId === ticket.id ? (
                          <div className="inline-flex items-center gap-1 bg-background p-1 border border-border rounded-xl shadow-xs">
                            <select
                              value={assignTechId}
                              onChange={e => setAssignTechId(e.target.value)}
                              className="px-2 py-1 bg-transparent text-xs font-medium focus:outline-none"
                            >
                              <option value="">Technician…</option>
                              {technicians.map(t => (
                                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssign(ticket.id)}
                              disabled={!assignTechId || busyId === ticket.id}
                              className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setAssigningId(null); setAssignTechId('') }}
                              className="p-1.5 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningId(ticket.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-semibold transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Assign
                          </button>
                        )
                      )}

                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(ticket.id, nextStatus)}
                          disabled={busyId === ticket.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 capitalize"
                        >
                          {busyId === ticket.id ? (
                            '…'
                          ) : (
                            <>
                              <span>Mark {STATUS_LABELS[nextStatus] || nextStatus}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}