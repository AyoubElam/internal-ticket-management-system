'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AuthUser } from './types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateUser: (patch: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'sigdi_auth_user'
const TOKEN_KEY = 'token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY)
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid email or password.' }
      }

      const authUser: AuthUser = {
        id:             data.user.id,
        email:          data.user.email,
        firstName:      data.user.firstName,
        lastName:       data.user.lastName,
        role:           data.user.role,
        zoneId:         data.user.zoneId,
        isActive:       data.user.isActive,
        avatarInitials: `${data.user.firstName[0]}${data.user.lastName[0]}`,
      } as AuthUser

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(authUser))
      setUser(authUser)

      return { success: true }
    } catch (err) {
      return { success: false, error: 'Network error. Is the backend running?' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  // NEW: patches the in-memory + localStorage user without a full
  // re-login. Used after a successful PATCH /users/me so the sidebar,
  // header, and profile page all reflect the new name immediately.
  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      if (patch.firstName || patch.lastName) {
        next.avatarInitials = `${next.firstName[0]}${next.lastName[0]}`
      }
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}