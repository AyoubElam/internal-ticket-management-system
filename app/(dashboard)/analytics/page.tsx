'use client'

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Clock, CheckCircle, AlertTriangle, Shield } from 'lucide-react'
import StatCard from '@/components/stat-card'
import { mockKpiStats } from '@/lib/mock-data'
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'

const CHART_COLORS = [
  'oklch(0.56 0.22 264)',  // blue
  'oklch(0.65 0.17 160)',  // green
  'oklch(0.75 0.18 60)',   // amber
  'oklch(0.68 0.19 330)',  // pink
  'oklch(0.62 0.20 20)',   // red
]

export default function AnalyticsPage() {
  const { user } = useAuth()
  if (!user || !['admin','support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted to admins and support agents.</p>
      </div>
    )
  }

  const kpi = mockKpiStats

  const categoryData = kpi.byCategory.map(c => ({
    name: CATEGORY_LABELS[c.category].replace(' ', '\n'),
    value: c.count,
    fullName: CATEGORY_LABELS[c.category],
  }))

  const statusData = kpi.byStatus.map(s => ({
    name: STATUS_LABELS[s.status],
    value: s.count,
  }))

  const priorityData = kpi.byPriority.map(p => ({
    name: PRIORITY_LABELS[p.priority],
    value: p.count,
  }))

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
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'oklch(0.56 0.012 250)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.56 0.012 250)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.16 0.018 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'oklch(0.94 0.008 247)', fontWeight: 600 }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis dataKey="fullName" tick={{ fontSize: 10, fill: 'oklch(0.56 0.012 250)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.56 0.012 250)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.16 0.018 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'oklch(0.94 0.008 247)', fontWeight: 600 }}
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
                  contentStyle={{ background: 'oklch(0.16 0.018 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: '8px', fontSize: '12px' }}
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
                {priorityData.map((_, i) => (
                  <Cell key={i} fill={['oklch(0.58 0.17 145)', 'oklch(0.75 0.18 60)', 'oklch(0.68 0.20 40)', 'oklch(0.62 0.20 20)'][i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'oklch(0.16 0.018 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {priorityData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ['oklch(0.58 0.17 145)', 'oklch(0.75 0.18 60)', 'oklch(0.68 0.20 40)', 'oklch(0.62 0.20 20)'][i] }} />
                  <span className="text-muted-foreground capitalize">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* SLA card */}
        <ChartCard title="SLA Performance" subtitle="Response & resolution compliance">
          <div className="space-y-4 pt-2">
            <SlaBar label="Overall SLA" value={kpi.slaCompliance} target={90} />
            <SlaBar label="Critical (<1h response)"  value={68} target={95} />
            <SlaBar label="High (<4h resolution)"    value={75} target={85} />
            <SlaBar label="Medium (<24h resolution)" value={82} target={80} />
            <SlaBar label="Low (<72h resolution)"    value={94} target={90} />
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
        <span className={`font-semibold ${met ? 'text-green-400' : 'text-red-400'}`}>{value}%</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-green-400' : 'bg-red-400'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
