'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { NotificationsProvider, useNotifications } from '@/lib/notifications-context'
import Sidebar from '@/components/sidebar'
import Topbar from '@/components/topbar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/tickets':        'Tickets',
  '/tickets/new':    'New Ticket',
  '/interventions':  'Interventions',
  '/analytics':      'Analytics & KPIs',
  '/users':          'User Management',
  '/zones':          'Zone Management',
  '/notifications':  'Notifications',
  '/profile':        'My Profile',
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const { unreadCount } = useNotifications()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || (path !== '/dashboard' && path !== '/tickets' && pathname.startsWith(path))
  )?.[1] ?? 'SIGDI'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadCount={unreadCount}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <DashboardShell>{children}</DashboardShell>
      </NotificationsProvider>
    </AuthProvider>
  )
}