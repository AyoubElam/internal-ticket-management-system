'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Clock, CheckCircle, AlertTriangle, Shield } from 'lucide-react'
import StatCard from '@/components/stat-card'
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'

// Theme-aware — these read your CSS variables at paint time, so charts
// stay correct if the palette changes (light/dark/anything else) instead
// of being hardcoded to one specific dark-mode set of OKLCH values.
const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const PRIORITY_CHART_COLORS: Record<TicketPriority, string> = {
  low:      'var(--priority-low)',
  medium:   'var(--priority-medium)',
  high:     'var(--priority-high)',
  critical: 'var(--priority-critical)',
}

// Same thresholds the backend's SQL actually enforces — keep these two
// in sync if the query ever changes.
const SLA_TARGETS: Record<TicketPriority, { window: string; target: number }> = {
  critical: { window: '≤4h resolution',   target: 95 },
  high:     { window: '≤24h resolution',  target: 85 },
  medium:   { window: '≤72h resolution',  target: 80 },
  low:      { window: '≤168h resolution', target: 90 },
}

type KpiStats = {
  totalTickets: number
  openTickets: number
  resolvedToday: number
  avgResolutionHours: number
  criticalOpen: number
  slaCompliance: number
  slaByPriority: { priority: TicketPriority; total: number; compliance: number }[]
  byStatus: { status: TicketStatus; count: number }[]
  byPriority: { priority: TicketPriority; count: number }[]
  byCategory: { category: TicketCategory; count: number }[]
  ticketsOverTime: { date: string; created: number; resolved: number }[]
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [kpi, setKpi] = useState<KpiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !['admin', 'support_agent'].includes(user.role)) return
    const fetchKpi = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:4000/api/analytics/kpi', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load analytics.')
        setKpi(data)
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    fetchKpi()
  }, [user])

  if (!user || !['admin', 'support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted to admins and support agents.</p>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Loading analytics…</p>
  }

  if (error || !kpi) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-muted-foreground text-sm">{error || 'No data available.'}</p>
      </div>
    )
  }

  const categoryData = kpi.byCategory.map(c => ({
    name: CATEGORY_LABELS[c.category],
    value: c.count,
    fullName: CATEGORY_LABELS[c.category],
  }))

  const statusData = kpi.byStatus
    .filter(s => STATUS_LABELS[s.status]) // guards against a stray '' from old bad data
    .map(s => ({ name: STATUS_LABELS[s.status], value: s.count }))

  const priorityData = kpi.byPriority.map(p => ({
    name: PRIORITY_LABELS[p.priority],
    priority: p.priority,
    value: p.count,
  }))

  const priorityOrder: TicketPriority[] = ['critical', 'high', 'medium', 'low']
  const slaBars = priorityOrder
    .map(p => kpi.slaByPriority.find(s => s.priority === p))
    .filter((s): s is NonNullable<typeof s> => !!s)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Tickets"     value={kpi.totalTickets}       icon={<TrendingUp className="w-4 h-4" />}     color="blue"   subtitle="All time" />
        <StatCard title="Open Tickets"      value={kpi.openTickets}        icon={<AlertTriangle className="w-4 h-4" />}  color="amber"  subtitle="Unresolved" />
        <StatCard title="Resolved Today"    value={kpi.resolvedToday}      icon={<CheckCircle className="w-4 h-4" />}    color="green"  subtitle="Last 24h" />
        <StatCard title="Avg. Resolution"   value={`${kpi.avgResolutionHours}h`} icon={<Clock className="w-4 h-4" />}  color="purple" subtitle="Average time" />
        <StatCard title="SLA Compliance"    value={`${kpi.slaCompliance}%`} icon={<Shield className="w-4 h-4" />}       color={kpi.slaCompliance >= 80 ? 'green' : 'red'} subtitle="On-time resolution" />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Tickets over time */}
        <ChartCard title="Tickets Over Time" subtitle="Created vs Resolved — last 7 days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={kpi.ticketsOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'var(--color-popover-foreground)', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="created"  stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Created" />
              <Line type="monotone" dataKey="resolved" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* By category */}
        <ChartCard title="Tickets by Category" subtitle="Distribution across request types">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="fullName" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'var(--color-popover-foreground)', fontWeight: 600 }}
              />
              <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Status pie */}
        <ChartCard title="By Status" subtitle="Current ticket states">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {statusData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Priority pie */}
        <ChartCard title="By Priority" subtitle="Open ticket urgency">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={priorityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {priorityData.map((item, i) => (
                  <Cell key={i} fill={PRIORITY_CHART_COLORS[item.priority]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {priorityData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_CHART_COLORS[item.priority] }} />
                  <span className="text-muted-foreground capitalize">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* SLA card — real per-priority numbers from the backend now,
            not hardcoded placeholders. */}
        <ChartCard title="SLA Performance" subtitle="Resolution compliance by priority">
          <div className="space-y-4 pt-2">
            <SlaBar label="Overall SLA" value={kpi.slaCompliance} target={90} />
            {slaBars.map(s => (
              <SlaBar
                key={s.priority}
                label={`${PRIORITY_LABELS[s.priority]} (${SLA_TARGETS[s.priority].window})`}
                value={s.compliance}
                target={SLA_TARGETS[s.priority].target}
              />
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function SlaBar({ label, value, target }: { label: string; value: number; target: number }) {
  const met = value >= target
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${met ? 'text-green-500' : 'text-red-500'}`}>{value}%</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}