'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radio } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { mockUsers, mockInterventions } from '@/lib/mock-data'
import { timeAgo, CATEGORY_LABELS, STATUS_LABELS, ROLE_LABELS } from '@/lib/helpers'
import type { Role, TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'

type ApiTicket = {
  id: number
  title: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  created_by_id: number
  assigned_to_id?: number
}

const PRIORITY_BARS: Record<TicketPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 }
const PRIORITY_COLOR: Record<TicketPriority, string> = {
  low: 'bg-green-400', medium: 'bg-amber-400', high: 'bg-orange-400', critical: 'bg-red-400',
}

/* Signature element: signal-strength bars standing in for priority — literal to a telecom support desk */
function SignalMeter({ priority }: { priority: TicketPriority }) {
  const active = PRIORITY_BARS[priority]
  return (
    <div className="flex items-end gap-[3px] h-4" title={`Priority: ${priority}`}>
      {[1, 2, 3, 4].map(bar => (
        <span
          key={bar}
          className={`w-[3px] rounded-sm transition-colors ${bar <= active ? PRIORITY_COLOR[priority] : 'bg-border'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  )
}

function useTickets() {
  const [tickets, setTickets] = useState<ApiTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:4000/api/tickets', {
          headers: { Authorization: `Bearer ${token}` },
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
    fetchTickets()
  }, [])

  return { tickets, loading, error }
}

export default function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-8">
      {user.role === 'admin'         && <AdminDashboard />}
      {user.role === 'support_agent' && <AgentDashboard />}
      {user.role === 'technician'    && <TechnicianDashboard />}
      {user.role === 'employee'      && <EmployeeDashboard />}
    </div>
  )
}

/* ── Shared header ── */
function Header({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border pb-5">
      <div>
        <p className="font-mono text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{sub}</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card border border-border rounded-md px-3 py-2">
        <span className="relative flex w-1.5 h-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-green-400" />
        </span>
        LINK UP
      </div>
    </div>
  )
}

/* ── Status rail — replaces the 4-card grid ── */
function StatusRail({ items, loading }: { items: { label: string; value: number; tone?: string }[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 border border-border rounded-xl overflow-hidden divide-x divide-y sm:divide-y-0 divide-border">
      {items.map((item, i) => (
        <div key={i} className="px-5 py-4 bg-card">
          <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{item.label}</p>
          <p className={`text-3xl font-bold tabular-nums mt-1 ${item.tone || 'text-foreground'}`}>
            {loading ? '···' : item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ── Admin ── */
function AdminDashboard() {
  const { tickets, loading, error } = useTickets()

  const total     = tickets.length
  const open      = tickets.filter(t => !['resolved','closed','cancelled'].includes(t.status)).length
  const critical  = tickets.filter(t => t.priority === 'critical' && !['resolved','closed','cancelled'].includes(t.status)).length
  const resolved  = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  const recent    = tickets.slice().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,6)

  return (
    <>
      <Header eyebrow="NOC / ADMIN" title="System Overview" sub="Full visibility across all tickets, users, and zones." />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <StatusRail loading={loading} items={[
        { label: 'Total Tickets', value: total },
        { label: 'Open',          value: open, tone: 'text-amber-400' },
        { label: 'Critical',      value: critical, tone: critical > 0 ? 'text-red-400' : undefined },
        { label: 'Resolved',      value: resolved, tone: 'text-green-400' },
      ]} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TicketStream title="Recent Tickets" tickets={recent} loading={loading} />
        </div>
        <div className="space-y-6">
          <TeamRoster />
          <PulseFeed />
        </div>
      </div>
    </>
  )
}

/* ── Agent ── */
function AgentDashboard() {
  const { user } = useAuth()
  const { tickets, loading, error } = useTickets()

  const myTickets  = tickets.filter(t => t.assigned_to_id === user?.id)
  const queue      = tickets.filter(t => t.status === 'created')
  const inProgress = tickets.filter(t => t.status === 'in_progress')
  const critical   = tickets.filter(t => t.priority === 'critical' && !['resolved','closed','cancelled'].includes(t.status))
  const recent     = myTickets.slice().sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0,6)

  return (
    <>
      <Header eyebrow="NOC / SUPPORT" title="Support Queue" sub="Review new tickets and manage ongoing assignments." />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <StatusRail loading={loading} items={[
        { label: 'My Assigned',  value: myTickets.length },
        { label: 'Queue',        value: queue.length, tone: 'text-amber-400' },
        { label: 'In Progress',  value: inProgress.length, tone: 'text-primary' },
        { label: 'Critical',     value: critical.length, tone: critical.length > 0 ? 'text-red-400' : undefined },
      ]} />

      <div className="grid lg:grid-cols-2 gap-6">
        <TicketStream title="Unassigned Queue" tickets={queue} loading={loading} showQueueBadge />
        <TicketStream title="My Recent Tickets" tickets={recent} loading={loading} compact />
      </div>
    </>
  )
}

/* ── Technician (still mock — no confirmed /api/interventions endpoint) ── */
function TechnicianDashboard() {
  const { user } = useAuth()
  const myInterventions = mockInterventions.filter(i => i.technicianId === user?.id)
  const activeCount     = myInterventions.filter(i => i.status !== 'completed').length
  const doneCount       = myInterventions.filter(i => i.status === 'completed').length

  return (
    <>
      <Header eyebrow="NOC / FIELD" title="My Interventions" sub="Track your field assignments and update intervention status." />

      <StatusRail items={[
        { label: 'Total',     value: myInterventions.length },
        { label: 'Active',    value: activeCount, tone: 'text-amber-400' },
        { label: 'Completed', value: doneCount, tone: 'text-green-400' },
      ]} />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">Assignments</p>
          <Link href="/interventions" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {myInterventions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No interventions assigned.</div>
        ) : (
          <div className="divide-y divide-border">
            {myInterventions.map(i => (
              <Link key={i.id} href={`/tickets/${i.ticketId}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors group">
                <span className="font-mono text-xs text-muted-foreground shrink-0">#{i.ticketId}</span>
                <p className="text-sm text-foreground truncate flex-1 group-hover:text-primary transition-colors">{i.notes}</p>
                <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${
                  i.status === 'completed'  ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  i.status === 'traveling'  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {i.status.replace('_',' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ── Employee ── */
function EmployeeDashboard() {
  const { user } = useAuth()
  const { tickets, loading, error } = useTickets()

  const myTickets  = tickets.filter(t => t.created_by_id === user?.id)
  const openCount  = myTickets.filter(t => !['resolved','closed','cancelled'].includes(t.status)).length
  const doneCount  = myTickets.filter(t => ['resolved','closed'].includes(t.status)).length
  const recent     = myTickets.slice().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,6)

  return (
    <>
      <Header eyebrow="NOC / REQUESTER" title="My Requests" sub="Submit and track your internal requests." />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <StatusRail loading={loading} items={[
        { label: 'Total',    value: myTickets.length },
        { label: 'Open',     value: openCount, tone: 'text-amber-400' },
        { label: 'Resolved', value: doneCount, tone: 'text-green-400' },
      ]} />

      <TicketStream title="Recent Tickets" tickets={recent} loading={loading} />
    </>
  )
}

/* ── Ticket stream — signature signal-meter replaces priority pills ── */
function TicketStream({
  title, tickets, loading, compact = false, showQueueBadge = false,
}: {
  title: string; tickets: ApiTicket[]; loading?: boolean; compact?: boolean; showQueueBadge?: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{title}</p>
        {showQueueBadge ? (
          <span className="text-xs font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
            {tickets.length} pending
          </span>
        ) : (
          <Link href="/tickets" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {tickets.map(ticket => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors group"
            >
              <SignalMeter priority={ticket.priority} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {ticket.title}
                </p>
                {!compact && (
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    #{ticket.id} · {CATEGORY_LABELS[ticket.category]} · {timeAgo(ticket.updated_at)}
                  </p>
                )}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide shrink-0">
                {STATUS_LABELS[ticket.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* NOTE: still mock — no confirmed /api/users endpoint yet */
function TeamRoster() {
  const roles = ['admin','support_agent','technician','employee'] as Role[]
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">Team Roster</p>
      </div>
      <div className="divide-y divide-border">
        {roles.map(role => {
          const count = mockUsers.filter(u => u.role === role && u.isActive).length
          return (
            <div key={role} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
              <span className="font-mono text-xs font-bold text-foreground">{String(count).padStart(2, '0')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* NOTE: still mock — no confirmed activity-log endpoint yet */
function PulseFeed() {
  const items = [
    { text: 'Ticket #8 escalated — Agadir fiber cut', time: '6m ago', tone: 'bg-red-400' },
    { text: 'Ticket #7 assigned to Khalid Tazi',      time: '22m ago', tone: 'bg-blue-400' },
    { text: 'Ticket #3 resolved by Sara Benali',      time: '3d ago', tone: 'bg-green-400' },
  ]
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">Pulse</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${item.tone}`} />
            <div className="min-w-0">
              <p className="text-xs text-foreground leading-snug">{item.text}</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}