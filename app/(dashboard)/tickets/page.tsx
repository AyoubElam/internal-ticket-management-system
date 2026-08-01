'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Filter, X, AlertTriangle, Inbox, Clock, MapPin, User } from 'lucide-react'
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
  zone_id?: number
  zone_name?: string
}

type Zone = { id: number; name: string }
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
const NEXT_STATUS: Record<string, TicketStatus | null> = {
  created: null,
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

  const [zones, setZones] = useState<Zone[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])

  // Filters
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [zoneId, setZoneId] = useState<string>('')

  // Row-level "assign" picker
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [assignTechId, setAssignTechId] = useState<string>('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const hasActiveFilters = !!(status || priority || category || zoneId)

  function authHeaders() {
    const token = localStorage.getItem('token')
    return { Authorization: `Bearer ${token}` }
  }

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/zones', { headers: authHeaders() })
        const data = await res.json()
        if (res.ok) setZones(Array.isArray(data) ? data : data.data || [])
      } catch {
        // silent
      }
    }
    fetchZones()
  }, [])

  useEffect(() => {
    if (!user || !['admin', 'support_agent'].includes(user.role)) return
    const fetchTechnicians = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/users?role=technician', { headers: authHeaders() })
        const data = await res.json()
        if (res.ok) setTechnicians(Array.isArray(data) ? data : data.data || [])
      } catch {
        // silent
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
      if (zoneId) params.set('zone_id', zoneId)

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
  }, [status, priority, category, zoneId])

  function clearFilters() {
    setStatus('')
    setPriority('')
    setCategory('')
    setZoneId('')
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

  const isTechnician = user?.role === 'technician'
  const canCreate = user ? ['admin', 'support_agent', 'employee'].includes(user.role) : false
  const canFilter = user ? ['admin', 'support_agent'].includes(user.role) : false
  const canAct = user ? ['admin', 'support_agent'].includes(user.role) : false

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isTechnician ? 'My Assigned Tickets' : 'Ticket Queue'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTechnician ? 'Manage and update your ongoing interventions.' : 'View, filter, and manage all incoming support requests.'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm hover:bg-primary/90 hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
        )}
      </div>

      {/* Filters Section */}
      {canFilter && (
        <div className="bg-card shadow-sm border border-border/60 rounded-xl p-5 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted rounded-md">
                <Filter className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">Filter Tickets</span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow cursor-pointer appearance-none"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>

            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow cursor-pointer appearance-none"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow cursor-pointer appearance-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>

            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              disabled={zones.length === 0}
              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-shadow cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Zones</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Data Table */}
      {!error && (
        <div className="bg-card border border-border/60 shadow-sm rounded-xl overflow-hidden relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full shadow-lg">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-medium text-muted-foreground">Loading tickets...</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/60">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Title</th>
                  <th className="px-5 py-3.5 font-medium">Category</th>
                  <th className="px-5 py-3.5 font-medium">Priority</th>
                  <th className="px-5 py-3.5 font-medium">Zone</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  {!isTechnician && <th className="px-5 py-3.5 font-medium hidden lg:table-cell">Assigned To</th>}
                  <th className="px-5 py-3.5 font-medium hidden lg:table-cell">Created</th>
                  {canAct && <th className="px-5 py-3.5 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {!loading && tickets.length === 0 ? (
                  <tr>
                    <td colSpan={isTechnician ? 6 : 8} className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Inbox className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">No tickets found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          {hasActiveFilters 
                            ? "We couldn't find any tickets matching your current filters." 
                            : "There are currently no tickets in the queue."}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="mt-4 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  tickets.map(ticket => {
                    const overdue = isOverdue(ticket)
                    const nextStatus = NEXT_STATUS[ticket.status] ?? null
                    
                    return (
                      <tr
                        key={ticket.id}
                        className={`group transition-colors ${
                          overdue 
                            ? 'bg-destructive/[0.03] hover:bg-destructive/[0.06] border-l-2 border-l-destructive/60' 
                            : 'hover:bg-muted/40 border-l-2 border-l-transparent'
                        }`}
                      >
                        <td className="px-5 py-4">
                          <Link 
                            href={`/tickets/${ticket.id}`} 
                            className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                            title={ticket.title}
                          >
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <CategoryBadge category={ticket.category as any} size="sm" />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <PriorityBadge priority={ticket.priority as any} size="sm" />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 opacity-70" />
                            <span className="truncate max-w-[120px]">{ticket.zone_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={ticket.status as any} size="sm" />
                            {overdue && (
                              <div className="group relative flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-destructive/80" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-foreground text-background text-[10px] rounded whitespace-nowrap z-10">
                                  Past SLA target
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        {!isTechnician && (
                          <td className="px-5 py-4 hidden lg:table-cell whitespace-nowrap">
                            {ticket.assigned_to_name ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-primary/20">
                                  {getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '')}
                                </div>
                                <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                                  {ticket.assigned_to_name}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <User className="w-3.5 h-3.5 opacity-50" />
                                <span className="text-sm italic">Unassigned</span>
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-4 hidden lg:table-cell whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5 opacity-70" />
                            <span>{timeAgo(ticket.created_at)}</span>
                          </div>
                        </td>
                        {canAct && (
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              
                              {/* Assign Action */}
                              {!ticket.assigned_to_id && ticket.status === 'created' && (
                                assigningId === ticket.id ? (
                                  <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/80 shadow-sm animate-in fade-in slide-in-from-right-2">
                                    <select
                                      value={assignTechId}
                                      onChange={e => setAssignTechId(e.target.value)}
                                      className="px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[140px]"
                                    >
                                      <option value="">Choose technician…</option>
                                      {technicians.map(t => (
                                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleAssign(ticket.id)}
                                      disabled={!assignTechId || busyId === ticket.id}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                      {busyId === ticket.id ? '…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => { setAssigningId(null); setAssignTechId('') }}
                                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAssigningId(ticket.id)}
                                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-semibold hover:bg-primary/20 transition-colors"
                                  >
                                    Assign
                                  </button>
                                )
                              )}

                              {/* Status Change Action */}
                              {nextStatus && assigningId !== ticket.id && (
                                <button
                                  onClick={() => handleStatusChange(ticket.id, nextStatus)}
                                  disabled={busyId === ticket.id}
                                  className="px-3 py-1.5 bg-accent/60 text-accent-foreground border border-border/50 rounded-md text-xs font-semibold hover:bg-accent hover:border-border transition-all disabled:opacity-50 capitalize whitespace-nowrap shadow-sm"
                                >
                                  {busyId === ticket.id ? 'Updating…' : `Mark ${STATUS_LABELS[nextStatus] || nextStatus}`}
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