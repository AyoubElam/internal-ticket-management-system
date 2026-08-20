'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Clock, TrendingUp, ShieldAlert, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'
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
  const { t } = useLanguage()
  const router = useRouter()
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isStaff = user ? ['admin', 'support_agent'].includes(user.role) : false

  // Silently redirect non-staff to /tickets
  useEffect(() => {
    if (user && !isStaff) {
      router.replace('/tickets')
    }
  }, [user, isStaff, router])

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard
              title={t('dashboard.total_tickets')}
              value={kpi?.totalTickets ?? tickets.length}
              icon={<TrendingUp className="w-4 h-4" />}
              color="blue"
            />
            <DashboardCard
              title={t('dashboard.pending_tickets')}
              value={pendingTickets}
              icon={<Clock className="w-4 h-4" />}
              color="amber"
            />
            <DashboardCard
              title={t('dashboard.critical_tickets')}
              value={criticalTickets}
              icon={<AlertTriangle className="w-4 h-4" />}
              color="red"
            />
            <DashboardCard
              title={t('dashboard.sla_alerts')}
              value={overdueTickets.length}
              icon={<ShieldAlert className="w-4 h-4" />}
              color={overdueTickets.length > 0 ? 'red' : 'green'}
            />
          </div>

          {/* SLA alerts list */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">{t('dashboard.sla_alerts')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.sla_desc')}</p>
              </div>
              <Link href="/tickets" className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-full">
                {t('dashboard.view_all')}
              </Link>
            </div>
            
            {overdueTickets.length === 0 ? (
              <div className="bg-card/80 backdrop-blur-sm border border-border/20 shadow-soft rounded-3xl p-10 text-center">
                <ShieldAlert className="w-8 h-8 text-green-500/40 mx-auto mb-2" />
                <p className="text-sm font-bold text-muted-foreground">
                  {t('dashboard.no_overdue')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdueTickets.slice(0, 9).map(t => (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className="bg-card/80 backdrop-blur-sm shadow-soft border border-red-500/30 rounded-2xl p-5 hover:-translate-y-1 hover:shadow-glow hover:border-red-500/50 transition-all duration-300 flex flex-col gap-3 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-start justify-between gap-2 relative">
                      <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight">
                        {t.title}
                      </p>
                      <span className="text-[10px] font-black text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shrink-0">#{t.id}</span>
                    </div>
                    
                    <div className="flex-1" />
                    
                    <div className="space-y-3 relative">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t.zone_name ?? t('dashboard.no_zone')} · {t('dashboard.created')} {timeAgo(t.created_at)}
                      </p>
                      
                      <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                        <PriorityBadge priority={t.priority} size="sm" />
                        <StatusBadge status={t.status as any} size="sm" />
                      </div>
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
    blue: 'bg-blue-500/10 text-blue-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    green: 'bg-green-500/10 text-green-500',
  }
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/20 rounded-2xl p-5 flex items-center gap-4 shadow-soft hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-default">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-none mt-1">{value}</p>
      </div>
    </div>
  )
}