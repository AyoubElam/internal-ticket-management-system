'use client'

import { useState } from 'react'
import { MapPin, Shield, Plus, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { mockZones, mockUsers, mockTickets } from '@/lib/mock-data'
import { formatDateShort } from '@/lib/helpers'

export default function ZonesPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  if (!user || !['admin', 'support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted.</p>
      </div>
    )
  }

  const filtered = mockZones.filter(z => {
    if (!search) return true
    const q = search.toLowerCase()
    return z.name.toLowerCase().includes(q) || z.region.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Zones</p>
          <p className="text-2xl font-bold text-foreground mt-1">{mockZones.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active Technicians</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {mockUsers.filter(u => u.role === 'technician' && u.isActive).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground">Open Tickets Across Zones</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {mockTickets.filter(t => !['resolved', 'closed'].includes(t.status)).length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search zones…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        {user.role === 'admin' && (
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors ml-auto">
            <Plus className="w-4 h-4" /> Add Zone
          </button>
        )}
      </div>

      {/* Zone grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(zone => {
          const zoneTechs   = mockUsers.filter(u => u.zoneId === zone.id && u.role === 'technician' && u.isActive)
          const zoneAgents  = mockUsers.filter(u => u.zoneId === zone.id && u.role === 'support_agent' && u.isActive)
          const openTickets = mockTickets.filter(t => t.zoneId === zone.id && !['resolved', 'closed'].includes(t.status))
          const criticalTickets = openTickets.filter(t => t.priority === 'critical')

          return (
            <div key={zone.id} className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-primary/30 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate">{zone.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{zone.region}</p>
                  </div>
                </div>
                {criticalTickets.length > 0 && (
                  <span className="shrink-0 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                    {criticalTickets.length} critical
                  </span>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{openTickets.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Open Tickets</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{zoneTechs.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Technicians</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{zoneAgents.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Agents</p>
                </div>
              </div>

              {/* Technician list */}
              {zoneTechs.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Technicians</p>
                  <div className="flex flex-wrap gap-1.5">
                    {zoneTechs.map(tech => (
                      <span key={tech.id} className="flex items-center gap-1 bg-muted/60 rounded-full px-2.5 py-1 text-[11px] text-foreground">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">
                          {tech.firstName[0]}{tech.lastName[0]}
                        </span>
                        {tech.firstName} {tech.lastName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <p className="text-[10px] text-muted-foreground">Created {formatDateShort(zone.createdAt)}</p>
                {user.role === 'admin' && (
                  <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Edit zone
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">No zones found.</div>
      )}
    </div>
  )
}
