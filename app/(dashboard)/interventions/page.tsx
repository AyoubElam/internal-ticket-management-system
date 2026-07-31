'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, MapPin, Search, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { InterventionBadge, PriorityBadge } from '@/components/status-badge'
import { mockInterventions, mockTickets, mockUsers, mockZones, enrichIntervention } from '@/lib/mock-data'
import { formatDateTime, timeAgo, CATEGORY_LABELS, getInitials, INTERVENTION_STATUS_LABELS } from '@/lib/helpers'
import type { InterventionStatus } from '@/lib/types'

const ALL_STATUSES: InterventionStatus[] = ['traveling', 'in_progress', 'completed']

export default function InterventionsPage() {
  const { user } = useAuth()
  const [filterStatus, setFilterStatus] = useState<InterventionStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  if (!user || !['admin', 'support_agent', 'technician'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted.</p>
      </div>
    )
  }

  const baseInterventions = useMemo(() => {
    if (user.role === 'technician') {
      return mockInterventions.filter(i => i.technicianId === user.id)
    }
    return mockInterventions
  }, [user])

  const enriched = useMemo(() => {
    return baseInterventions
      .filter(i => filterStatus === 'all' || i.status === filterStatus)
      .filter(i => {
        if (!search) return true
        const ticket = mockTickets.find(t => t.id === i.ticketId)
        const q = search.toLowerCase()
        return ticket?.title.toLowerCase().includes(q) || String(i.ticketId).includes(q)
      })
      .map(enrichIntervention)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [baseInterventions, filterStatus, search])

  const totalActive    = baseInterventions.filter(i => i.status !== 'completed').length
  const totalCompleted = baseInterventions.filter(i => i.status === 'completed').length

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Interventions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{baseInterventions.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalActive}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{totalCompleted}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search interventions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          {(['all', ...ALL_STATUSES] as (InterventionStatus | 'all')[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? 'All' : INTERVENTION_STATUS_LABELS[s as InterventionStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Interventions list */}
      <div className="space-y-3">
        {enriched.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
            No interventions found.
          </div>
        ) : enriched.map(intervention => {
          const ticket    = intervention.ticket
          const tech      = intervention.technician
          const zone      = ticket?.zoneId ? mockZones.find(z => z.id === ticket.zoneId) : null
          return (
            <div key={intervention.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  intervention.status === 'completed'  ? 'bg-green-500/10' :
                  intervention.status === 'traveling'  ? 'bg-blue-500/10' : 'bg-amber-500/10'
                }`}>
                  <Wrench className={`w-4 h-4 ${
                    intervention.status === 'completed'  ? 'text-green-400' :
                    intervention.status === 'traveling'  ? 'text-blue-400' : 'text-amber-400'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <Link
                        href={`/tickets/${intervention.ticketId}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        Ticket #{intervention.ticketId}
                        {ticket && ` — ${ticket.title}`}
                      </Link>
                      {zone && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" /> {zone.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ticket && <PriorityBadge priority={ticket.priority} size="sm" />}
                      <InterventionBadge status={intervention.status} />
                    </div>
                  </div>

                  {/* Notes */}
                  {intervention.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                      {intervention.notes}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                    {tech && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                          {getInitials(tech.firstName, tech.lastName)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tech.firstName} {tech.lastName}
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      Updated {timeAgo(intervention.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
