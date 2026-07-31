'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Ticket, Users, MapPin, BarChart3,
  Wrench, Bell, LogOut, Wifi, ChevronRight, X
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ROLE_LABELS } from '@/lib/helpers'
import { getInitials } from '@/lib/helpers'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: Role[]
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  {
    href:  '/dashboard',
    label: 'Dashboard',
    icon:  <LayoutDashboard className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician', 'employee'],
  },
  {
    href:  '/tickets',
    label: 'Tickets',
    icon:  <Ticket className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician', 'employee'],
  },
  {
    href:  '/interventions',
    label: 'Interventions',
    icon:  <Wrench className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician'],
  },
  {
    href:  '/analytics',
    label: 'Analytics',
    icon:  <BarChart3 className="w-4 h-4" />,
    roles: ['admin', 'support_agent'],
  },
  {
    href:  '/users',
    label: 'Users',
    icon:  <Users className="w-4 h-4" />,
    roles: ['admin'],
  },
  {
    href:  '/zones',
    label: 'Zones',
    icon:  <MapPin className="w-4 h-4" />,
    roles: ['admin', 'support_agent'],
  },
  {
    href:  '/notifications',
    label: 'Notifications',
    icon:  <Bell className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician', 'employee'],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  unreadCount?: number
}

export default function Sidebar({ open, onClose, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  if (!user) return null

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role))

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col border-r border-sidebar-border',
          'transition-transform duration-300',
          'lg:relative lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-bold text-sm leading-none">WIFI Maroc</p>
              <p className="text-sidebar-foreground/50 text-[10px] mt-0.5">SIGDI</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visibleNav.map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const badgeCount = item.href === '/notifications' ? unreadCount : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <span className="flex items-center gap-3">
                  <span className={cn(
                    'transition-colors',
                    isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground'
                  )}>
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                {badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/50">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground text-xs font-semibold truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sidebar-foreground/50 text-[10px] truncate">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-sidebar-foreground/40 hover:text-red-400 transition-colors shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
