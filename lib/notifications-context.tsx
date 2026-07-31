'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth-context'

export type Notification = {
  id: number
  user_id: number
  message: string
  is_read: number | boolean
  created_at: string
}

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

const POLL_INTERVAL_MS = 20000

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:4000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setNotifications(data.data || [])
    } catch {
      // silent — next poll retries
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, refresh])

  const markRead = useCallback(async (id: number) => {
    // Optimistic — updates both the badge and the list immediately since
    // they share this same state.
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)))
    try {
      const token = localStorage.getItem('token')
      await fetch(`http://localhost:4000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // silent — resynced on next poll
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
    try {
      const token = localStorage.getItem('token')
      await fetch('http://localhost:4000/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // silent
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}