'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  SlidersHorizontal,
  X,
  AlertCircle,
  Calendar,
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
import { STATUS_LABELS, timeAgo, getInitials } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'
import type { TicketCategory, TicketPriority, TicketStatus, Category } from '@/lib/types'
import { cn } from '@/lib/utils'

type Ticket = {
  id: number
  title: string
  category: string
  category_label?: string
  priority: string
  status: string
  created_at: string
  resolved_at?: string | null
  created_by_name?: string
  assigned_to_name?: string
  assigned_to_id?: number | null
}

type Technician = { id: number; first_name: string; last_name: string }

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
  const { t } = useLanguage()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const [technicians, setTechnicians] = useState<Technician[]>([])

  // Categories now come from the API instead of a hardcoded array.
  const [categories, setCategories] = useState<Category[]>([])

  // Filters
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [period, setPeriod] = useState<7 | 30 | 'all'>(7)

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

  const hasActiveFilters = !!(status || priority || category || period !== 'all')

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/categories', { headers: authHeaders() })
        const data = await res.json()
        if (res.ok) setCategories(data)
      } catch {
        // silent fail — filter just won't show category options
      }
    }
    fetchCategories()
  }, [])

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
  }, [tickets.length, status, priority, category, period])

  function clearFilters() {
    setStatus('')
    setPriority('')
    setCategory('')
    setPeriod('all')
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
const showPeriodFilter = canFilter || isTechnician || user?.role === 'employee'

  // Client-side period filter
  const periodFilteredTickets = (() => {
    if (period === 'all') return tickets
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - period)
    cutoff.setHours(0, 0, 0, 0)
    return tickets.filter(t => new Date(t.created_at) >= cutoff)
  })()

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/80 backdrop-blur-sm p-6 rounded-2xl border border-border/20 shadow-soft">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isTechnician ? t('tickets.my_assigned') : t('tickets.queue')}
            </h1>
            {!loading && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">
                {tickets.length}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isTechnician ? t('tickets.tech_desc') : t('tickets.queue_desc')}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 rounded-xl shadow-glow hover:bg-primary/90 transition-all duration-300 ease-out active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> {t('tickets.create')}
          </Link>
        )}
      </div>

      {/* Period Filter — visible for admin, agent, technician */}
      {showPeriodFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border/20 rounded-2xl p-1.5 shadow-soft">
            <Calendar className="w-4 h-4 text-muted-foreground ml-2 mr-1 shrink-0" />
            {([7, 30, 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap',
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {p === 7 ? 'Last 7 Days' : p === 30 ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {periodFilteredTickets.length} ticket{periodFilteredTickets.length !== 1 ? 's' : ''}
            {period !== 'all' ? ` in last ${period} days` : ' total'}
          </span>
        </div>
      )}

      {/* Filter Toolbar */}
      {canFilter && (
        <div className="mb-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Pill Tabs for Status */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/20 rounded-xl overflow-x-auto max-w-full hide-scrollbar shadow-inner">
              <button
                onClick={() => setStatus('')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300",
                  status === '' ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {t('tickets.all_requests')}
              </button>
              {['created', 'pending_assignment', 'in_progress', 'resolved'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300",
                    status === s ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
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
                className="px-4 py-2 bg-card/80 border border-border/20 rounded-xl text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:text-foreground transition-all duration-300 appearance-none capitalize shadow-soft hover:shadow-glow cursor-pointer"
              >
                <option value="">{t('tickets.priority_all')}</option>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="px-4 py-2 bg-card/80 border border-border/20 rounded-xl text-xs font-bold text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:text-foreground transition-all duration-300 appearance-none shadow-soft hover:shadow-glow cursor-pointer"
              >
                <option value="">{t('tickets.category_all')}</option>
                {categories.map(c => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
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
            <span className="text-sm font-semibold text-foreground">{t('tickets.items_selected')}</span>
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
                    <option value="">{t('tickets.choose_tech')}</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!bulkAssignTechId || bulkBusy}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {bulkBusy ? t('tickets.assigning') : t('common.confirm')}
                  </button>
                  <button
                    onClick={() => { setShowBulkAssign(false); setBulkAssignTechId('') }}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkAssign(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 shadow-2xs transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" /> {t('tickets.assign_selected')}
                </button>
              )
            )}

            {allSelectedAreResolved && (
              <button
                onClick={() => handleBulkStatus('closed')}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-2xs transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {bulkBusy ? t('tickets.closing') : t('tickets.mark_closed')}
              </button>
            )}

            {allSelectedAreCreated && (
              <button
                onClick={() => handleBulkStatus('cancelled')}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold hover:bg-rose-100 shadow-2xs transition-all disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" /> {bulkBusy ? t('tickets.cancelling') : t('tickets.cancel_requests')}
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
              {t('tickets.deselect_all')}
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
            <p className="text-xs font-medium">{t('tickets.loading')}</p>
          </div>
        ) : periodFilteredTickets.length === 0 ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-16 text-center">
            <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
              <Inbox className="w-10 h-10 stroke-1 opacity-50" />
              <p className="text-sm font-semibold text-foreground">
                {period !== 'all' ? `No tickets in the last ${period} days` : t('tickets.no_tickets')}
              </p>
              <p className="text-xs">
                {period !== 'all' ? 'Try switching to Last 30 Days or All Time' : hasActiveFilters ? t('tickets.no_tickets_filter') : t('tickets.no_tickets_desc')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {periodFilteredTickets.map(ticket => {
              const overdue = isOverdue(ticket)
              const nextStatus = NEXT_STATUS[ticket.status] ?? null
              const isSelected = selected.has(ticket.id)

              return (
                <div
                  key={ticket.id}
                  className={cn(
                    "group relative flex flex-col gap-4 p-6 bg-card/80 backdrop-blur-sm rounded-3xl border transition-all duration-300 ease-out hover:-translate-y-1",
                    isSelected
                      ? "border-primary/50 bg-primary/5 shadow-glow"
                      : overdue
                      ? "border-rose-200 bg-rose-50/30 shadow-soft hover:border-rose-300 hover:shadow-glow"
                      : "border-border/20 shadow-soft hover:shadow-glow"
                  )}
                >
                  <div className="flex items-start gap-4 w-full">
                    {canBulk && (
                      <button
                        onClick={() => toggleSelected(ticket.id)}
                        className="mt-1.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    )}

                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-black text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shrink-0">#{ticket.id}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black bg-rose-100 text-rose-700 rounded-lg">
                            <Clock className="w-3 h-3 text-rose-600" /> {t('tickets.overdue')}
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="text-lg font-black text-foreground hover:text-primary transition-colors line-clamp-2 leading-tight mt-1 mb-2"
                      >
                        {ticket.title}
                      </Link>

                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <CategoryBadge category={ticket.category} label={ticket.category_label} size="sm" />
                        <PriorityBadge priority={ticket.priority as any} size="sm" />
                        <StatusBadge status={ticket.status as any} size="sm" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/20">
                    <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
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
                              <span className="italic">{t('tickets.unassigned')}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {canAct && (
                      <div className="flex items-center gap-2 shrink-0">
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
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold transition-colors shadow-sm"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Assign
                          </button>
                        )
                      )}

                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(ticket.id, nextStatus)}
                          disabled={busyId === ticket.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 capitalize shadow-sm"
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