'use client'

import { useState } from 'react'
import { Search, UserPlus, Shield, Check, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { RoleBadge } from '@/components/status-badge'
import { mockUsers, mockZones } from '@/lib/mock-data'
import { formatDateShort, getInitials, ROLE_LABELS } from '@/lib/helpers'
import type { Role } from '@/lib/types'

export default function UsersPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all')

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Admin access required.</p>
      </div>
    )
  }

  const filtered = mockUsers.filter(u => {
    const matchRole = filterRole === 'all' || u.role === filterRole
    const q = search.toLowerCase()
    const matchSearch = !search ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const roles: (Role | 'all')[] = ['all', 'admin', 'support_agent', 'technician', 'employee']

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['admin','support_agent','technician','employee'] as Role[]).map(role => {
          const count = mockUsers.filter(u => u.role === role && u.isActive).length
          return (
            <div key={role} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filterRole === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {r === 'all' ? 'All' : r.replace('_',' ')}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors ml-auto">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No users found.</td>
                </tr>
              ) : filtered.map(u => {
                const zone = u.zoneId ? mockZones.find(z => z.id === u.zoneId) : null
                return (
                  <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {getInitials(u.firstName, u.lastName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-xs text-muted-foreground">
                      {zone ? zone.name : <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDateShort(u.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${
                        u.isActive
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}>
                        {u.isActive
                          ? <><Check className="w-3 h-3" /> Active</>
                          : <><X className="w-3 h-3" /> Inactive</>
                        }
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent">
                          Edit
                        </button>
                        <button className={`text-xs px-2 py-1 rounded transition-colors hover:bg-accent ${
                          u.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                        }`}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
