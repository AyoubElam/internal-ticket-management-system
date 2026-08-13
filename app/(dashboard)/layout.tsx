'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { NotificationsProvider, useNotifications } from '@/lib/notifications-context'
import Sidebar from '@/components/sidebar'
import Topbar from '@/components/topbar'
import AnimatedBackground from '@/components/animated-background'
import { cn } from '@/lib/utils'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(true)
    } else {
      setSidebarCollapsed(prev => !prev)
    }
  }

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
    <div className="flex h-screen overflow-hidden bg-background p-0 md:p-2 lg:p-4 relative">
      <AnimatedBackground />
      {/* Desktop Sidebar Container */}
      <div 
        className={cn(
          "hidden lg:block h-full transition-all duration-300 shrink-0",
          sidebarCollapsed ? "w-0 opacity-0 mr-0 overflow-hidden" : "w-64 opacity-100 mr-2 md:mr-3"
        )}
      >
        <div className="w-64 h-full">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            unreadCount={unreadCount}
          />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadCount={unreadCount}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card/80 backdrop-blur-md md:rounded-2xl shadow-soft relative z-10">
        <Topbar
          onMenuClick={toggleSidebar}
          title={title}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex justify-center">
          <div className="w-full max-w-6xl">
            {children}
          </div>
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