'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, TrendingUp, ShieldAlert, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { timeAgo } from '@/lib/helpers'

type Ticket = {
  id: number
  title: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  created_at: string
  resolved_at?: string | null
  zone_name?: string
  assigned_to_name?: string
}

type Kpi = {
  totalTickets: number
  openTickets: number
  resolvedToday: number
  avgResolutionHours: number
  criticalOpen: number
  slaCompliance: number
}

// Mirrors the SLA windows used server-side in analytics.controller.ts
const SLA_HOURS: Record<string, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
}

function isOverdue(t: Ticket): boolean {
  if (['resolved', 'closed', 'cancelled'].includes(t.status)) return false
  const limit = SLA_HOURS[t.priority] ?? 168
  const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 36e5
  return ageHours > limit
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isStaff = user ? ['admin', 'support_agent'].includes(user.role) : false

  useEffect(() => {
    if (!isStaff) return
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        const headers = { Authorization: `Bearer ${token}` }
        const [kpiRes, ticketsRes] = await Promise.all([
          fetch('http://localhost:4000/api/analytics/kpi', { headers }),
          fetch('http://localhost:4000/api/tickets?limit=100', { headers }),
        ])
        const kpiData = await kpiRes.json()
        const ticketsData = await ticketsRes.json()
        if (!kpiRes.ok) throw new Error(kpiData.error || 'Failed to load KPIs.')
        if (!ticketsRes.ok) throw new Error(ticketsData.error || 'Failed to load tickets.')
        setKpi(kpiData)
        setTickets(ticketsData.data || [])
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isStaff])

  if (!user || !isStaff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted to admins and support agents.</p>
      </div>
    )
  }

  const pendingTickets = tickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status)).length
  const criticalTickets = tickets.filter(
    t => t.priority === 'critical' && !['resolved', 'closed', 'cancelled'].includes(t.status)
  ).length
  const overdueTickets = tickets
    .filter(isOverdue)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Control center overview</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard
              title="Total Tickets"
              value={kpi?.totalTickets ?? tickets.length}
              icon={<TrendingUp className="w-4 h-4" />}
              color="blue"
            />
            <DashboardCard
              title="Pending Tickets"
              value={pendingTickets}
              icon={<Clock className="w-4 h-4" />}
              color="amber"
            />
            <DashboardCard
              title="Critical Tickets"
              value={criticalTickets}
              icon={<AlertTriangle className="w-4 h-4" />}
              color="red"
            />
            <DashboardCard
              title="SLA Alerts"
              value={overdueTickets.length}
              icon={<ShieldAlert className="w-4 h-4" />}
              color={overdueTickets.length > 0 ? 'red' : 'green'}
            />
          </div>

          {/* SLA alerts list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">SLA Alerts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tickets past their resolution target</p>
              </div>
              <Link href="/tickets" className="text-xs text-primary hover:underline">
                View all tickets
              </Link>
            </div>
            {overdueTickets.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No overdue tickets. SLA is on track.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {overdueTickets.slice(0, 8).map(t => (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        #{t.id} — {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.zone_name ?? 'No zone'} · Created {timeAgo(t.created_at)}
                        {t.assigned_to_name ? ` · Assigned to ${t.assigned_to_name}` : ' · Unassigned'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={t.priority} size="sm" />
                      <StatusBadge status={t.status as any} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DashboardCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'blue' | 'amber' | 'red' | 'green'
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
    green: 'bg-green-500/10 text-green-400',
  }
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}