'use client'

import { useEffect, useState } from 'react'
import { MapPin, Shield, Plus, Search, Loader2, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { formatDateShort } from '@/lib/helpers'

interface Zone {
  id: number
  name: string
  region: string
  created_at: string
  technician_count: number
  agent_count: number
  open_ticket_count: number
  critical_ticket_count: number
}

interface ZoneTechnician {
  id: number
  first_name: string
  last_name: string
  role: 'technician' | 'support_agent'
}

export default function ZonesPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [techsByZone, setTechsByZone] = useState<Record<number, ZoneTechnician[]>>({})

  const [modalOpen, setModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [formName, setFormName] = useState('')
  const [formRegion, setFormRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const canView = user && ['admin', 'support_agent'].includes(user.role)

  async function loadZones() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/zones', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load zones.')
      const data: Zone[] = await res.json()
      setZones(data)

      // Fetch technician/agent rosters per zone in parallel
      const entries = await Promise.all(
        data.map(async z => {
          try {
            const r = await fetch(`/api/zones/${z.id}/technicians`, { credentials: 'include' })
            if (!r.ok) return [z.id, []] as const
            const list: ZoneTechnician[] = await r.json()
            return [z.id, list] as const
          } catch {
            return [z.id, []] as const
          }
        })
      )
      setTechsByZone(Object.fromEntries(entries))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load zones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) loadZones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  if (!user || !['admin', 'support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Access restricted.</p>
      </div>
    )
  }

  function openAddModal() {
    setEditingZone(null)
    setFormName('')
    setFormRegion('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(zone: Zone) {
    setEditingZone(zone)
    setFormName(zone.name)
    setFormRegion(zone.region)
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formRegion.trim()) {
      setFormError('Name and region are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const isEdit = !!editingZone
      const res = await fetch(isEdit ? `/api/zones/${editingZone!.id}` : '/api/zones', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: formName.trim(), region: formRegion.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Failed to save zone.')
      setModalOpen(false)
      await loadZones()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save zone.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = zones.filter(z => {
    if (!search) return true
    const q = search.toLowerCase()
    return z.name.toLowerCase().includes(q) || z.region.toLowerCase().includes(q)
  })

  const totalActiveTechs = zones.reduce((sum, z) => sum + z.technician_count, 0)
  const totalOpenTickets = zones.reduce((sum, z) => sum + z.open_ticket_count, 0)

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Zones</p>
          <p className="text-2xl font-bold text-foreground mt-1">{loading ? '—' : zones.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active Technicians</p>
          <p className="text-2xl font-bold text-foreground mt-1">{loading ? '—' : totalActiveTechs}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground">Open Tickets Across Zones</p>
          <p className="text-2xl font-bold text-foreground mt-1">{loading ? '—' : totalOpenTickets}</p>
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
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors ml-auto"
          >
            <Plus className="w-4 h-4" /> Add Zone
          </button>
        )}
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading zones…
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={loadZones} className="text-xs text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Zone grid */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(zone => {
            const roster = techsByZone[zone.id] || []
            const zoneTechs = roster.filter(t => t.role === 'technician')

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
                  {zone.critical_ticket_count > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                      {zone.critical_ticket_count} critical
                    </span>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{zone.open_ticket_count}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Open Tickets</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{zone.technician_count}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Technicians</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{zone.agent_count}</p>
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
                            {tech.first_name[0]}{tech.last_name[0]}
                          </span>
                          {tech.first_name} {tech.last_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground">Created {formatDateShort(zone.created_at)}</p>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => openEditModal(zone)}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Edit zone
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">No zones found.</div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">
                {editingZone ? 'Edit Zone' : 'Add Zone'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Region</label>
                <input
                  type="text"
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="text-sm px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingZone ? 'Save changes' : 'Create zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}