'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass, Ticket, Users, Radar,
  Zap, RadioReceiver, LogOut, Radio, ChevronRight, X, Award, UserCircle, Tags
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ROLE_LABELS, getHomeRoute } from '@/lib/helpers'
import { getInitials } from '@/lib/helpers'
import { useLanguage } from '@/lib/i18n/language-context'
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
    icon:  <Compass className="w-4 h-4" />,
    roles: ['admin', 'support_agent'],
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
    icon:  <Zap className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician'],
  },
      {
    href:  '/technicians',
    label: 'technicians',
    icon:  <Tags className="w-4 h-4" />,
    roles: ['admin' , 'support_agent'],
  },
  {
    href:  '/analytics',
    label: 'Analytics',
    icon:  <Radar className="w-4 h-4" />,
    roles: ['admin', 'support_agent'],
  },
  {
    href:  '/ratings',
    label: 'Ratings',
    icon:  <Award className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician'],
  },
  {
    href:  '/users',
    label: 'Users',
    icon:  <Users className="w-4 h-4" />,
    roles: ['admin'],
  },
  {
    href:  '/categories',
    label: 'Categories',
    icon:  <Tags className="w-4 h-4" />,
    roles: ['admin'],
  },
  {
    href:  '/notifications',
    label: 'Notifications',
    icon:  <RadioReceiver className="w-4 h-4" />,
    roles: ['admin', 'support_agent', 'technician', 'employee'],
  },
  {
    href:  '/profile',
    label: 'Profile',
    icon:  <UserCircle className="w-4 h-4" />,
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
  const { t } = useLanguage()

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
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar/95 backdrop-blur-md',
          'transition-all duration-300 ease-out',
          'lg:relative lg:translate-x-0 lg:z-auto lg:rounded-2xl lg:shadow-soft card-border',
          open ? 'translate-x-0 shadow-soft' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0">
          <Link href={getHomeRoute(user.role)} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-glow">
              <Radio className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sidebar-foreground font-bold text-sm tracking-tight leading-none">WIFI Maroc</p>
              <p className="text-sidebar-foreground/50 text-[10px] mt-0.5 tracking-wider">SIGDI</p>
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
                  'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-out group active:scale-[0.98]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-glow font-bold'
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
                  {t(`sidebar.${item.label.toLowerCase()}`)}
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
        <div className="px-3 py-3 shrink-0">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
          >
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
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); logout() }}
              className="text-sidebar-foreground/40 hover:text-red-400 transition-colors shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </aside>
    </>
  )
}