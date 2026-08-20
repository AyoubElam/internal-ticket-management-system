'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Clock, ChevronDown, ChevronUp, Wrench } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { timeAgo, getInitials } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'

type Technician = {
  id: number
  first_name: string
  last_name: string
  active_tickets: number
}

type Ticket = {
  id: number
  title: string
  status: string
  priority: string
  created_at: string
  assigned_to_id: number | null
}

function workload(count: number) {
  if (count === 0) return { label: 'Free',       dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
  if (count <= 2)   return { label: 'Busy',       dot: 'bg-amber-500',   text: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' }
  return              { label: 'Overloaded', dot: 'bg-rose-500',   text: 'text-rose-600',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20' }
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

export default function TechniciansPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [techRes, ticketsRes] = await Promise.all([
          fetch('http://localhost:4000/api/users?role=technician&is_active=true', { headers: authHeaders() }),
          fetch('http://localhost:4000/api/tickets?limit=100', { headers: authHeaders() }),
        ])
        const techData = await techRes.json()
        const ticketsData = await ticketsRes.json()
        if (!techRes.ok) throw new Error(techData.error || 'Failed to load technicians.')
        if (!ticketsRes.ok) throw new Error(ticketsData.error || 'Failed to load tickets.')
        setTechnicians(techData)
        setTickets(ticketsData.data || [])
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (!user || !['admin', 'support_agent'].includes(user.role)) return null

  const sorted = [...technicians].sort((a, b) => b.active_tickets - a.active_tickets)

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto pb-8">
      <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl border border-border/20 shadow-soft">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('technicians.title')}</h1>
          {!loading && (
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">
              {technicians.length}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('technicians.subtitle')}</p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-12 text-center text-muted-foreground space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Loading technicians…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-card/60 border border-border/60 rounded-2xl p-16 text-center">
            <Users className="w-10 h-10 stroke-1 opacity-50 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No active technicians</p>
          </div>
        ) : (
          sorted.map(tech => {
            const w = workload(tech.active_tickets)
            const isOpen = expanded === tech.id
            const techTickets = tickets.filter(
              t => t.assigned_to_id === tech.id && ['assigned', 'in_progress'].includes(t.status)
            )

            return (
              <div
                key={tech.id}
                className={cn('bg-card/80 backdrop-blur-sm border rounded-2xl shadow-soft overflow-hidden transition-all', w.border)}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : tech.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/20 transition-colors"
                >
                  <span className="relative w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0 shadow-inner">
                    {getInitials(tech.first_name, tech.last_name)}
                    <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', w.dot)} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{tech.first_name} {tech.last_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tech.active_tickets} active ticket{tech.active_tickets !== 1 ? 's' : ''}</p>
                  </div>

                  <span className={cn('text-xs font-black px-3 py-1.5 rounded-full shrink-0', w.bg, w.text)}>
                    {w.label}
                  </span>

                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border/20 divide-y divide-border/10">
                    {techTickets.length === 0 ? (
                      <p className="px-5 py-4 text-xs text-muted-foreground text-center">No active tickets right now.</p>
                    ) : (
                      techTickets.map(t => (
                        <Link
                          key={t.id}
                          href={`/tickets/${t.id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                        >
                          <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-mono font-black text-muted-foreground shrink-0">#{t.id}</span>
                          <span className="text-sm font-semibold text-foreground truncate flex-1">{t.title}</span>
                          <PriorityBadge priority={t.priority as any} size="sm" />
                          <StatusBadge status={t.status as any} size="sm" />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" /> {timeAgo(t.created_at)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}