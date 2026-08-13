'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Clock, CheckCircle, AlertTriangle, Shield, Calendar } from 'lucide-react'
import StatCard from '@/components/stat-card'
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

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

type Period = 7 | 30

export default function AnalyticsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [kpi, setKpi] = useState<KpiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>(7)

  useEffect(() => {
    if (!user || !['admin', 'support_agent'].includes(user.role)) return
    const fetchKpi = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        // Pass the period as a query param; the backend uses it if it supports it,
        // otherwise the frontend filters ticketsOverTime client-side.
        const res = await fetch(`http://localhost:4000/api/analytics/kpi?days=${period}`, {
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
  }, [user, period])

  if (!user || !['admin', 'support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{t('dashboard.access_restricted')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !kpi) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <p className="text-muted-foreground text-sm">{error || 'No data available.'}</p>
      </div>
    )
  }

  // Slice the last N days of data client-side as a fallback
  // (backend may or may not honour the ?days= param)
  const filteredOverTime = kpi.ticketsOverTime.slice(-period)

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
      {/* Header with period switcher */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground">{t('analytics.title') || 'Analytics'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {period === 7 ? 'Showing data for the last 7 days' : 'Showing data for the last 30 days'}
          </p>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border/20 rounded-2xl p-1.5 shadow-soft">
          <Calendar className="w-4 h-4 text-muted-foreground ml-2 mr-1" />
          {([7, 30] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all duration-300',
                period === p
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {p === 7 ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title={t('analytics.total_tickets')}     value={kpi.totalTickets}       icon={<TrendingUp className="w-4 h-4" />}     color="blue"   subtitle={t('analytics.all_time')} />
        <StatCard title={t('analytics.open_tickets')}      value={kpi.openTickets}        icon={<AlertTriangle className="w-4 h-4" />}  color="amber"  subtitle={t('analytics.unresolved')} />
        <StatCard title={t('analytics.resolved_today')}    value={kpi.resolvedToday}      icon={<CheckCircle className="w-4 h-4" />}    color="green"  subtitle={t('analytics.last_24h')} />
        <StatCard title={t('analytics.avg_resolution')}    value={`${kpi.avgResolutionHours}h`} icon={<Clock className="w-4 h-4" />}  color="purple" subtitle={t('analytics.avg_time')} />
        <StatCard title={t('analytics.sla_compliance')}    value={`${kpi.slaCompliance}%`} icon={<Shield className="w-4 h-4" />}       color={kpi.slaCompliance >= 80 ? 'green' : 'red'} subtitle={t('analytics.on_time')} />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Tickets over time */}
        <ChartCard
          title={t('analytics.tickets_over_time')}
          subtitle={period === 7 ? 'Daily volume over the last 7 days' : 'Daily volume over the last 30 days'}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={filteredOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
        <ChartCard title={t('analytics.tickets_by_category')} subtitle={t('analytics.category_desc')}>
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
        <ChartCard title={t('analytics.by_status')} subtitle={t('analytics.status_desc')}>
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
        <ChartCard title={t('analytics.by_priority')} subtitle={t('analytics.priority_desc')}>
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

        {/* SLA card */}
        <ChartCard title={t('analytics.sla_performance')} subtitle={t('analytics.sla_perf_desc')}>
          <div className="space-y-4 pt-2">
            <SlaBar label={t('analytics.overall_sla')} value={kpi.slaCompliance} target={90} />
            {slaBars.map(s => (
              <SlaBar
                key={s.priority}
                label={`${PRIORITY_LABELS[s.priority]} (${SLA_TARGETS[s.priority].window.replace('resolution', t('analytics.resolution'))})`}
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
    <div className="bg-card/80 backdrop-blur-sm border border-border/20 rounded-2xl p-6 flex flex-col space-y-4 shadow-soft hover:shadow-glow transition-all duration-300 ease-out">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
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