'use client'

import { useEffect, useState } from 'react'
import {
  Search, UserPlus, Shield, Check, X, Loader2,
  CheckSquare, Square, Users, UserCheck, UserX, ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { RoleBadge } from '@/components/status-badge'
import { formatDateShort, getInitials, ROLE_LABELS } from '@/lib/helpers'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

type User = {
  id: number
  email: string
  first_name: string
  last_name: string
  role: Role
  is_active: number | boolean
  created_at: string
}

const ROLES: Role[] = ['admin', 'support_agent', 'technician', 'employee']

function authHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

export default function UsersPage() {
  const { user } = useAuth()

  const [users, setUsers]     = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search, setSearch]         = useState('')
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all')

  const [showAddModal, setShowAddModal]   = useState(false)
  const [editingUser, setEditingUser]     = useState<User | null>(null)
  const [busyId, setBusyId]               = useState<number | null>(null)
  const [rowError, setRowError]           = useState('')

  // Bulk selection state
  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy]         = useState(false)
  const [bulkError, setBulkError]       = useState('')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:4000/api/users', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users.')
      setUsers(Array.isArray(data) ? data : data.data || [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  // Clear selection when filter/search changes
  useEffect(() => { setSelected(new Set()) }, [search, filterRole])

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Admin access required.</p>
      </div>
    )
  }

  const filtered = users.filter(u => {
    const matchRole = filterRole === 'all' || u.role === filterRole
    const q = search.toLowerCase()
    const matchSearch = !search ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const roleFilters: (Role | 'all')[] = ['all', 'admin', 'support_agent', 'technician', 'employee']

  // ── Selection helpers ──────────────────────────────────────────────────────
  function toggleSelected(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    // Only allow selecting users that aren't the current admin
    const selectableIds = filtered.filter(u => u.id !== user.id).map(u => u.id)
    if (selected.size === selectableIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  const allSelectableIds = filtered.filter(u => u.id !== user.id).map(u => u.id)
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every(id => selected.has(id))

  // ── Single row toggle ──────────────────────────────────────────────────────
  async function toggleActive(target: User) {
    setBusyId(target.id)
    setRowError('')
    try {
      const res = await fetch(`http://localhost:4000/api/users/${target.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !target.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user.')
      await fetchUsers()
    } catch (err: any) {
      setRowError(err.message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  async function bulkSetActive(isActive: boolean) {
    if (selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    const ids = [...selected]
    let failed = 0
    try {
      await Promise.all(ids.map(async id => {
        const res = await fetch(`http://localhost:4000/api/users/${id}`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive }),
        })
        if (!res.ok) failed++
      }))
      if (failed > 0) setBulkError(`${failed} user(s) could not be updated.`)
      setSelected(new Set())
      await fetchUsers()
    } catch (err: any) {
      setBulkError(err.message || 'Bulk action failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkSetRole(role: Role) {
    if (selected.size === 0) return
    setBulkBusy(true)
    setBulkError('')
    setShowRoleDropdown(false)
    const ids = [...selected]
    let failed = 0
    try {
      await Promise.all(ids.map(async id => {
        const res = await fetch(`http://localhost:4000/api/users/${id}`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        })
        if (!res.ok) failed++
      }))
      if (failed > 0) setBulkError(`${failed} user(s) role could not be changed.`)
      setSelected(new Set())
      await fetchUsers()
    } catch (err: any) {
      setBulkError(err.message || 'Bulk role change failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role && !!u.is_active).length
          return (
            <div key={role} className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-xs font-semibold text-muted-foreground">{ROLE_LABELS[role]}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{loading ? '—' : count}</p>
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
            className="w-full pl-9 pr-4 py-2.5 bg-card/80 backdrop-blur-sm border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-soft transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border/20 rounded-xl p-1 shadow-soft">
          {roleFilters.map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                filterRole === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {r === 'all' ? 'All' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 rounded-xl shadow-glow hover:bg-primary/90 transition-all duration-300 ml-auto active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-soft flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black">
              {selected.size}
            </span>
            <span className="text-sm font-bold text-foreground">
              {selected.size === 1 ? '1 user selected' : `${selected.size} users selected`}
            </span>
          </div>

          {bulkError && <p className="text-xs font-bold text-destructive basis-full">{bulkError}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Activate */}
            <button
              onClick={() => bulkSetActive(true)}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {bulkBusy ? '…' : 'Activate All'}
            </button>

            {/* Deactivate */}
            <button
              onClick={() => bulkSetActive(false)}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 text-rose-600 border border-rose-500/30 rounded-xl text-xs font-bold hover:bg-rose-500/20 shadow-sm transition-all disabled:opacity-50"
            >
              <UserX className="w-3.5 h-3.5" />
              {bulkBusy ? '…' : 'Deactivate All'}
            </button>

            {/* Change Role dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(v => !v)}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 shadow-sm transition-all disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5" />
                Change Role
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showRoleDropdown && 'rotate-180')} />
              </button>
              {showRoleDropdown && (
                <div className="absolute top-full mt-2 right-0 z-50 bg-card border border-border/20 rounded-2xl shadow-glow p-1.5 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-150">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => bulkSetRole(r)}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors capitalize"
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelected(new Set())}
              className="text-xs font-bold text-muted-foreground hover:text-foreground underline underline-offset-2 ml-2"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      {/* Table */}
      <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 bg-muted/30">
                <th className="px-5 py-4 w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Select all"
                  >
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 opacity-50" />
                    }
                  </button>
                </th>
                <th className="text-left px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                <th className="text-left px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No users found.</td>
                </tr>
              ) : filtered.map(u => {
                const isSelected = selected.has(u.id)
                const isSelf = u.id === user.id
                return (
                  <tr
                    key={u.id}
                    className={cn(
                      'hover:bg-accent/40 transition-colors',
                      isSelected && 'bg-primary/5 hover:bg-primary/10'
                    )}
                  >
                    <td className="px-5 py-4">
                      {!isSelf ? (
                        <button
                          onClick={() => toggleSelected(u.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 opacity-40 hover:opacity-100 transition-opacity" />
                          }
                        </button>
                      ) : (
                        <span className="w-4 h-4 block" />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
                          isSelected ? 'bg-primary/30 text-primary' : 'bg-primary/20 text-primary'
                        )}>
                          {getInitials(u.first_name, u.last_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground text-sm">{u.first_name} {u.last_name}</p>
                          <p className="text-xs font-medium text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs font-medium text-muted-foreground">
                      {formatDateShort(u.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${
                        u.is_active
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}>
                        {u.is_active
                          ? <><Check className="w-3 h-3" /> Active</>
                          : <><X className="w-3 h-3" /> Inactive</>
                        }
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-accent"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? "You can't deactivate your own account" : undefined}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.is_active ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          {busyId === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
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

      {showAddModal && (
        <UserModal
          mode="create"
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchUsers() }}
        />
      )}

      {editingUser && (
        <UserModal
          mode="edit"
          existing={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); fetchUsers() }}
        />
      )}
    </div>
  )
}

function UserModal({
  mode, existing, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  existing?: User
  onClose: () => void
  onSaved: () => void
}) {
  const [email, setEmail]         = useState(existing?.email ?? '')
  const [password, setPassword]   = useState('')
  const [firstName, setFirstName] = useState(existing?.first_name ?? '')
  const [lastName, setLastName]   = useState(existing?.last_name ?? '')
  const [role, setRole]           = useState<Role>(existing?.role ?? 'employee')
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const isEdit = mode === 'edit'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!isEdit && (!email.trim() || !password.trim())) {
      setFormError('Email and password are required.')
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First and last name are required.')
      return
    }

    setSaving(true)
    try {
      const url = isEdit
        ? `http://localhost:4000/api/users/${existing!.id}`
        : 'http://localhost:4000/api/users'

      const body = isEdit
        ? { first_name: firstName, last_name: lastName, role }
        : { email: email.trim(), password, first_name: firstName, last_name: lastName, role }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save user.')
      onSaved()
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/20 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">
            {isEdit ? 'Edit User' : 'Add User'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground bg-muted/50 p-1.5 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-xs font-bold text-destructive bg-destructive/10 px-3 py-2.5 rounded-xl">{formError}</p>}

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">First name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Last name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border/50 rounded-2xl text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-black shadow-glow hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}