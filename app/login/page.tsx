'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Wifi, AlertCircle, ChevronDown, Loader2, Shield, Headset, Wrench, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getHomeRoute } from '@/lib/helpers'
import LoginBackgroundLines from '@/components/login-background-lines'
import type { Role } from '@/lib/types'

const DEMO_ACCOUNTS: { email: string; role: Role; label: string; icon: React.ReactNode }[] = [
  { email: 'admin@wifimaroc.ma',  role: 'admin',         label: 'Admin',      icon: <Shield className="w-3.5 h-3.5" /> },
  { email: 'agent1@wifimaroc.ma', role: 'support_agent', label: 'Agent',      icon: <Headset className="w-3.5 h-3.5" /> },
  { email: 'tech1@wifimaroc.ma',  role: 'technician',    label: 'Technician', icon: <Wrench className="w-3.5 h-3.5" /> },
  { email: 'emp1@wifimaroc.ma',   role: 'employee',      label: 'Employee',   icon: <User className="w-3.5 h-3.5" /> },
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
      router.replace(getHomeRoute(user.role))
    }
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)
    if (result.success) {
      router.replace(getHomeRoute(result.user?.role ?? 'employee'))
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
      {/* Dynamic Looping Vector Lines matching reference mockup */}
      <LoginBackgroundLines />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-glow ring-4 ring-primary/20 transition-all hover:scale-105">
            <Wifi className="w-6 h-6 text-primary-foreground stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">SIGDI</h1>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">Sign in to WIFI Maroc</p>
        </div>

        {/* Card with deliberate outline and soft backdrop blur */}
        <div className="bg-card/90 backdrop-blur-md rounded-3xl p-7 shadow-2xl card-border relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-xl px-3.5 py-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@wifimaroc.ma"
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-2.5 pr-11 bg-background border border-border/60 rounded-xl text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-black shadow-glow hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDemo(v => !v)}
            className="flex items-center gap-1.5 mx-auto text-xs font-bold text-muted-foreground hover:text-foreground transition-colors bg-card/60 backdrop-blur-sm px-3 py-1.5 rounded-full card-border"
          >
            Try a demo account
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDemo ? 'rotate-180' : ''}`} />
          </button>

          {showDemo && (
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-3 py-1.5 rounded-full border border-border/60 bg-card/70 backdrop-blur-sm text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all duration-200 shadow-xs"
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