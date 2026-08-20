'use client'

import { useEffect, useState } from 'react'
import { Plus, Shield, Check, X, Loader2, GripVertical, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'

type Category = {
  id: number
  slug: string
  label: string
  sla_hours: number | null
  is_active: number | boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

export default function CategoriesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [rowError, setRowError]     = useState('')
  const [busyId, setBusyId]         = useState<number | null>(null)

  const [showAddModal, setShowAddModal]     = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  async function fetchCategories() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:4000/api/categories/admin', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load categories.')
      setCategories(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') fetchCategories()
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

  async function toggleActive(cat: Category) {
    setBusyId(cat.id)
    setRowError('')
    try {
      const res = await fetch(`http://localhost:4000/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update category.')
      await fetchCategories()
    } catch (err: any) {
      setRowError(err.message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.label}"? If it's in use by any ticket, it'll be deactivated instead of removed.`)) return
    setBusyId(cat.id)
    setRowError('')
    try {
      const res = await fetch(`http://localhost:4000/api/categories/${cat.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete category.')
      await fetchCategories()
    } catch (err: any) {
      setRowError(err.message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  async function moveOrder(cat: Category, direction: 'up' | 'down') {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(c => c.id === cat.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const other = sorted[swapIdx]
    setBusyId(cat.id)
    setRowError('')
    try {
      await Promise.all([
        fetch(`http://localhost:4000/api/categories/${cat.id}`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`http://localhost:4000/api/categories/${other.id}`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: cat.sort_order }),
        }),
      ])
      await fetchCategories()
    } catch {
      setRowError('Failed to reorder categories.')
    } finally {
      setBusyId(null)
    }
  }

  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('categories.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('categories.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('categories.add_category')}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Label</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading categories…
                  </td>
                </tr>
              ) : sortedCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No categories yet.</td>
                </tr>
              ) : sortedCategories.map((cat, i) => (
                <tr key={cat.id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveOrder(cat, 'up')}
                          disabled={i === 0 || busyId === cat.id}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveOrder(cat, 'down')}
                          disabled={i === sortedCategories.length - 1 || busyId === cat.id}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-foreground text-sm">{cat.label}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <code className="text-xs text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">{cat.slug}</code>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {cat.sla_hours ? `${cat.sla_hours}h` : <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 ${
                      cat.is_active
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    }`}>
                      {cat.is_active
                        ? <><Check className="w-3 h-3" /> Active</>
                        : <><X className="w-3 h-3" /> Inactive</>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => toggleActive(cat)}
                        disabled={busyId === cat.id}
                        className={`text-xs px-2 py-1 rounded transition-colors hover:bg-accent disabled:opacity-40 ${
                          cat.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'
                        }`}
                      >
                        {busyId === cat.id ? '…' : cat.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={busyId === cat.id}
                        className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
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
        <CategoryModal
          mode="create"
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchCategories() }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          mode="edit"
          existing={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={() => { setEditingCategory(null); fetchCategories() }}
        />
      )}
    </div>
  )
}

function CategoryModal({
  mode, existing, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  existing?: Category
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel]         = useState(existing?.label ?? '')
  const [slaHours, setSlaHours]   = useState(existing?.sla_hours != null ? String(existing.sla_hours) : '')
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const isEdit = mode === 'edit'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!label.trim()) {
      setFormError('Label is required.')
      return
    }

    setSaving(true)
    try {
      const url = isEdit
        ? `http://localhost:4000/api/categories/${existing!.id}`
        : 'http://localhost:4000/api/categories'

      const body = {
        label: label.trim(),
        sla_hours: slaHours.trim() ? Number(slaHours) : null,
      }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save category.')
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
            {isEdit ? 'Edit Category' : 'Add Category'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Label</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Software Support"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {!isEdit && (
              <p className="text-[10px] text-muted-foreground">
                A URL-safe slug will be generated from this automatically (e.g. "software_support").
              </p>
            )}
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Slug</label>
              <input
                value={existing!.slug}
                disabled
                className="w-full px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground">
                Slug can't be changed once created — tickets already reference it directly.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">SLA (hours)</label>
            <input
              type="number"
              min={0}
              value={slaHours}
              onChange={e => setSlaHours(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}