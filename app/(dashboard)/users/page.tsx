'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus, Shield, Check, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { RoleBadge } from '@/components/status-badge'
import { formatDateShort, getInitials, ROLE_LABELS } from '@/lib/helpers'
import type { Role } from '@/lib/types'

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

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role && !!u.is_active).length
          return (
            <div key={role} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
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
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
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
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors ml-auto"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No users found.</td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                        {getInitials(u.first_name, u.last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDateShort(u.created_at)}
                  </td>
                  <td className="px-4 py-3.5">
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
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={busyId === u.id || u.id === user.id}
                        title={u.id === user.id ? "You can't deactivate your own account" : undefined}
                        className={`text-xs px-2 py-1 rounded transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                        }`}
                      >
                        {busyId === u.id ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Edit User' : 'Add User'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-xs text-destructive">{formError}</p>}

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">First name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Last name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}