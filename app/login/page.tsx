'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Wifi, AlertCircle, ChevronDown, Loader2, Shield, Headset, Wrench, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/lib/types'

const DEMO_ACCOUNTS: { email: string; role: Role; label: string; icon: React.ReactNode }[] = [
  { email: 'admin@wifimaroc.ma',  role: 'admin',         label: 'Admin',      icon: <Shield className="w-3 h-3" /> },
  { email: 'agent1@wifimaroc.ma', role: 'support_agent', label: 'Agent',      icon: <Headset className="w-3 h-3" /> },
  { email: 'tech1@wifimaroc.ma',  role: 'technician',    label: 'Technician', icon: <Wrench className="w-3 h-3" /> },
  { email: 'emp1@wifimaroc.ma',   role: 'employee',      label: 'Employee',   icon: <User className="w-3 h-3" /> },
]

export default function LoginPage() {
  const router = useRouter()
  const { login, user, loading } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDemo, setShowDemo] = useState(false)

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
    setShowDemo(false)
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 relative overflow-hidden">
      {/* Soft glow behind everything — subtle depth without a full split panel */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          opacity: 0.06,
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Wifi className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">SIGDI</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to WIFI Maroc</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@wifimaroc.ma"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDemo(v => !v)}
            className="flex items-center gap-1 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Try a demo account
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDemo ? 'rotate-180' : ''}`} />
          </button>

          {showDemo && (
            <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-accent transition-colors"
                >
                  {acc.icon}
                  {acc.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}