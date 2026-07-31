'use client'

import { Menu, Bell, Plus } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getInitials, ROLE_LABELS } from '@/lib/helpers'

interface TopbarProps {
  onMenuClick: () => void
  title: string
  unreadCount?: number
}

export default function Topbar({ onMenuClick, title, unreadCount = 0 }: TopbarProps) {
  const { user } = useAuth()
  if (!user) return null

  const canCreateTicket = ['employee', 'support_agent', 'admin'].includes(user.role)

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {canCreateTicket && (
          <Link
            href="/tickets/new"
            className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Ticket
          </Link>
        )}

        <Link
          href="/notifications"
          className="relative text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>

        <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">
            {getInitials(user.firstName, user.lastName)}
          </div>
          <span className="hidden md:block text-xs font-medium text-foreground">
            {user.firstName}
          </span>
        </Link>
      </div>
    </header>
  )
}
