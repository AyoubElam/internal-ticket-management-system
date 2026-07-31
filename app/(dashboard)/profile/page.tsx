'use client'

import { useState } from 'react'
import { User, Mail, Shield, MapPin, Calendar, Key, Check } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { RoleBadge } from '@/components/status-badge'
import { mockZones, mockTickets, mockInterventions } from '@/lib/mock-data'
import { formatDateShort, getInitials, ROLE_LABELS } from '@/lib/helpers'

export default function ProfilePage() {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)

  if (!user) return null

  const zone = user.zoneId ? mockZones.find(z => z.id === user.zoneId) : null

  const myTickets = mockTickets.filter(t =>
    user.role === 'employee'
      ? t.createdById === user.id
      : t.assignedToId === user.id
  )
  const myInterventions = mockInterventions.filter(i => i.technicianId === user.id)
  const resolvedTickets = myTickets.filter(t => ['resolved', 'closed'].includes(t.status))

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Profile header card */}
      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-6 flex-wrap">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
          {getInitials(user.firstName, user.lastName)}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-xl font-bold text-foreground">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <RoleBadge role={user.role} />
            {zone && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 border border-border rounded-full px-2.5 py-0.5">
                <MapPin className="w-3 h-3" /> {zone.name}
              </span>
            )}
            <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${
              user.isActive
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
            }`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {user.role !== 'technician' && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              {user.role === 'employee' ? 'Tickets Submitted' : 'Tickets Assigned'}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{myTickets.length}</p>
          </div>
        )}
        {user.role === 'technician' && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Interventions</p>
            <p className="text-2xl font-bold text-foreground mt-1">{myInterventions.length}</p>
          </div>
        )}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Resolved</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{resolvedTickets.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Member Since</p>
          <p className="text-sm font-bold text-foreground mt-1">{formatDateShort(user.createdAt)}</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" /> Account Information
          </h3>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">First Name</label>
              <input
                type="text"
                defaultValue={user.firstName}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Last Name</label>
              <input
                type="text"
                defaultValue={user.lastName}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
            </label>
            <input
              type="email"
              defaultValue={user.email}
              readOnly
              className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed. Contact your administrator.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" /> Role
            </label>
            <input
              type="text"
              value={ROLE_LABELS[user.role]}
              readOnly
              className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {saved && <Check className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save changes'}
            </button>
            <button type="button" className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" /> Change Password
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Current Password</label>
            <input
              type="password"
              placeholder="••••••••••"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">New Password</label>
              <input
                type="password"
                placeholder="••••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Update password
          </button>
        </div>
      </div>
    </div>
  )
}
