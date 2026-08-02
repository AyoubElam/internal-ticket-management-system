'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Filter, X, AlertTriangle } from 'lucide-react'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { timeAgo, getInitials, CATEGORY_LABELS, STATUS_LABELS } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'

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
  location_label?: string
}

type Technician = { id: number; first_name: string; last_name: string }

const CATEGORIES: TicketCategory[] = ['network_support', 'field_intervention', 'equipment_request', 'system_access']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: TicketStatus[] = ['created', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled']

// Mirrors the SLA windows used server-side in analytics.controller.ts
const SLA_HOURS: Record<string, number> = { critical: 4, high: 24, medium: 72, low: 168 }

function isOverdue(t: Ticket): boolean {
  if (['resolved', 'closed', 'cancelled'].includes(t.status)) return false
  const limit = SLA_HOURS[t.priority] ?? 168
  const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 36e5
  return ageHours > limit
}

// Forward status transitions a staff member can trigger from the queue.
// (Technician-only transitions are still enforced server-side.)
const NEXT_STATUS: Record<string, TicketStatus | null> = {
  created: null, // use Assign instead
  assigned: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
  closed: null,
  cancelled: null,
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

  // Row-level "assign" picker: which ticket id has its technician select open
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [assignTechId, setAssignTechId] = useState<string>('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const hasActiveFilters = !!(status || priority || category)

  function authHeaders() {
    const token = localStorage.getItem('token')
    return { Authorization: `Bearer ${token}` }
  }

  useEffect(() => {
    // Technician list, needed for the Assign action. Only staff can assign,
    // so no point fetching it for other roles.
    if (!user || !['admin', 'support_agent'].includes(user.role)) return
    const fetchTechnicians = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/users?role=technician', { headers: authHeaders() })
        const data = await res.json()
        if (res.ok) setTechnicians(Array.isArray(data) ? data : data.data || [])
      } catch {
        // silent — Assign action will just show no technicians available
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

  // Backend already scopes the query by role (employees see their own,
  // technicians see only what's assigned to them) — this just mirrors
  // that in the copy/UI so it doesn't read as a bug.
  const isTechnician = user?.role === 'technician'
  const canCreate = user ? ['admin', 'support_agent', 'employee'].includes(user.role) : false
  const canFilter = user ? ['admin', 'support_agent'].includes(user.role) : false
  const canAct = user ? ['admin', 'support_agent'].includes(user.role) : false

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isTechnician ? 'My Assigned Tickets' : 'Ticket Queue'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isTechnician ? 'Tickets assigned to you' : 'All support requests'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/tickets/new"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
        )}
      </div>

      {/* Filters — admin/support_agent only; employees & technicians already
          get a pre-scoped list from the backend so filtering the queue
          doesn't apply the same way to them. */}
      {canFilter && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>

            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading tickets…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!loading && !error && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  {!isTechnician && <th className="px-4 py-3 hidden lg:table-cell">Assigned To</th>}
                  <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                  {canAct && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={isTechnician ? 6 : 8} className="px-4 py-8 text-center text-muted-foreground">
                      {hasActiveFilters ? 'No tickets match these filters.' : 'No tickets found.'}
                    </td>
                  </tr>
                ) : (
                  tickets.map(ticket => {
                    const overdue = isOverdue(ticket)
                    const nextStatus = NEXT_STATUS[ticket.status] ?? null
                    return (
                      <tr
                        key={ticket.id}
                        className={`transition-colors ${overdue ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-accent'}`}
                      >
                        <td className="px-4 py-3.5">
                          <Link href={`/tickets/${ticket.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <CategoryBadge category={ticket.category as any} size="sm" />
                        </td>
                        <td className="px-4 py-3.5">
                          <PriorityBadge priority={ticket.priority as any} size="sm" />
                        </td>
                        {/* Exact picked location */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[160px] truncate" title={ticket.location_label || undefined}>
                          {ticket.location_label ?? '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={ticket.status as any} size="sm" />
                            {overdue && (
                              <span title="Past SLA target">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        {!isTechnician && (
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            {ticket.assigned_to_name ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '')}
                                </div>
                                <span className="text-xs text-foreground truncate max-w-[120px]">
                                  {ticket.assigned_to_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(ticket.created_at)}
                        </td>
                        {canAct && (
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Assign — only makes sense while unassigned */}
                              {!ticket.assigned_to_id && ticket.status === 'created' && (
                                assigningId === ticket.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={assignTechId}
                                      onChange={e => setAssignTechId(e.target.value)}
                                      className="px-2 py-1 bg-background border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                      <option value="">Choose technician…</option>
                                      {technicians.map(t => (
                                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleAssign(ticket.id)}
                                      disabled={!assignTechId || busyId === ticket.id}
                                      className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50"
                                    >
                                      {busyId === ticket.id ? '…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => { setAssigningId(null); setAssignTechId('') }}
                                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAssigningId(ticket.id)}
                                    className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium hover:bg-primary/20 transition-colors"
                                  >
                                    Assign
                                  </button>
                                )
                              )}

                              {/* Status change */}
                              {nextStatus && (
                                <button
                                  onClick={() => handleStatusChange(ticket.id, nextStatus)}
                                  disabled={busyId === ticket.id}
                                  className="px-2.5 py-1 bg-accent text-foreground rounded-md text-xs font-medium hover:bg-accent/70 transition-colors disabled:opacity-50 capitalize"
                                >
                                  {busyId === ticket.id ? '…' : `Mark ${STATUS_LABELS[nextStatus] || nextStatus}`}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}