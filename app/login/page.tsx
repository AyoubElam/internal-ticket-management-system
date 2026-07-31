'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Wifi, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ROLE_LABELS } from '@/lib/helpers'
import type { Role } from '@/lib/types'

const DEMO_ACCOUNTS: { email: string; role: Role; label: string }[] = [
  { email: 'admin@wifimaroc.ma',  role: 'admin',         label: 'Administrator' },
  { email: 'agent1@wifimaroc.ma', role: 'support_agent', label: 'Support Agent' },
  { email: 'tech1@wifimaroc.ma',  role: 'technician',    label: 'Technician' },
  { email: 'emp1@wifimaroc.ma',   role: 'employee',      label: 'Employee' },
]

export default function LoginPage() {
  const router = useRouter()
  const { login, user, loading } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)
    if (result.success) {
      router.replace('/dashboard')
    } else {
      setError(result.error ?? 'Login failed.')
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('Password123!')
    setError('')
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12 relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(oklch(0.88 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.88 0 0) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sidebar-foreground font-bold text-lg leading-none">WIFI Maroc</p>
            <p className="text-sidebar-foreground/50 text-xs mt-0.5">Internal Systems</p>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative space-y-6">
          <h1 className="text-sidebar-foreground text-4xl font-bold leading-tight tracking-tight">
            Intelligent<br />Request<br />Management
          </h1>
          <p className="text-sidebar-foreground/60 text-base leading-relaxed max-w-sm">
            Centralize, track, and resolve internal requests across all teams — support agents, technicians, and administrators in one unified platform.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { label: 'Tickets Managed', value: '2,400+' },
              { label: 'Avg. Resolution', value: '< 4h' },
              { label: 'Active Technicians', value: '18' },
              { label: 'SLA Compliance', value: '94%' },
            ].map(({ label, value }) => (
              <div key={label} className="border border-sidebar-border rounded-lg p-4">
                <p className="text-sidebar-foreground text-2xl font-bold">{value}</p>
                <p className="text-sidebar-foreground/50 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-sidebar-foreground/30 text-xs">
          © 2025 WIFI Maroc — SIGDI v1.0
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">WIFI Maroc — SIGDI</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
            <p className="text-muted-foreground text-sm">
              Enter your credentials to access the dashboard
            </p>
          </div>

          {/* Demo accounts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick demo access</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="text-left border border-border rounded-lg px-3 py-2.5 hover:border-primary/60 hover:bg-accent transition-colors group"
                >
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {acc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{acc.email}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or enter manually</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@wifimaroc.ma"
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Demo password for all accounts:{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">Password123!</code>
          </p>
        </div>
      </div>
    </div>
  )
}
