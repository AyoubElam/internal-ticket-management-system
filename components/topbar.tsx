'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, AlignLeft, Plus, CheckCheck, X, Ticket, Wrench, Star, Info, Clock, Globe } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getInitials, ROLE_LABELS } from '@/lib/helpers'
import { useNotifications } from '@/lib/notifications-context'
import { useLanguage } from '@/lib/i18n/language-context'
import { timeAgo } from '@/lib/helpers'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onMenuClick: () => void
  title: string
  unreadCount?: number
}

function notifIcon(message: string) {
  const m = message.toLowerCase()
  if (m.includes('ticket')) return <Ticket className="w-4 h-4" />
  if (m.includes('intervention') || m.includes('technician') || m.includes('assign')) return <Wrench className="w-4 h-4" />
  if (m.includes('rating') || m.includes('star')) return <Star className="w-4 h-4" />
  if (m.includes('resolved') || m.includes('closed')) return <CheckCheck className="w-4 h-4" />
  return <Info className="w-4 h-4" />
}

function notifColor(message: string) {
  const m = message.toLowerCase()
  if (m.includes('ticket')) return 'bg-blue-500/15 text-blue-500'
  if (m.includes('intervention') || m.includes('assign')) return 'bg-violet-500/15 text-violet-500'
  if (m.includes('rating')) return 'bg-amber-400/15 text-amber-500'
  if (m.includes('resolved') || m.includes('closed')) return 'bg-emerald-500/15 text-emerald-500'
  return 'bg-muted text-muted-foreground'
}

export default function Topbar({ onMenuClick, title }: TopbarProps) {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const langPanelRef = useRef<HTMLDivElement>(null)
  const langButtonRef = useRef<HTMLButtonElement>(null)

  if (!user) return null

  const canCreateTicket = ['employee', 'support_agent', 'admin'].includes(user.role)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
      if (
        langPanelRef.current && !langPanelRef.current.contains(e.target as Node) &&
        langButtonRef.current && !langButtonRef.current.contains(e.target as Node)
      ) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const recent = notifications.slice(0, 8)

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 shrink-0 relative z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <AlignLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground capitalize tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {canCreateTicket && (
          <Link
            href="/tickets/new"
            className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl shadow-glow hover:bg-primary/90 transition-all duration-300 ease-out active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'fr' ? 'Nouveau Ticket' : 'New Ticket'}
          </Link>
        )}

        {/* Language Switcher */}
        <div className="relative">
          <button
            ref={langButtonRef}
            onClick={() => setLangOpen(prev => !prev)}
            className={cn(
              'relative p-2 rounded-xl transition-all flex items-center gap-1',
              langOpen
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-label="Language"
          >
            <Globe className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">{language}</span>
          </button>
          
          {langOpen && (
            <div
              ref={langPanelRef}
              className="absolute right-0 top-[calc(100%+8px)] w-32 flex flex-col bg-card/90 backdrop-blur-md rounded-xl border border-border/40 shadow-soft overflow-hidden z-50 p-1"
              style={{ animation: 'fadeSlideDown 0.15s ease-out' }}
            >
              <button 
                onClick={() => { setLanguage('en'); setLangOpen(false); }}
                className={cn(
                  "px-3 py-2 text-sm text-left rounded-lg transition-colors hover:bg-accent",
                  language === 'en' ? "bg-primary/10 text-primary font-bold" : "text-foreground font-medium"
                )}
              >
                🇬🇧 English
              </button>
              <button 
                onClick={() => { setLanguage('fr'); setLangOpen(false); }}
                className={cn(
                  "px-3 py-2 text-sm text-left rounded-lg transition-colors hover:bg-accent mt-1",
                  language === 'fr' ? "bg-primary/10 text-primary font-bold" : "text-foreground font-medium"
                )}
              >
                🇫🇷 Français
              </button>
            </div>
          )}
        </div>

        {/* Notification Bell + Dropdown */}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setOpen(prev => !prev)}
            className={cn(
              'relative p-2 rounded-xl transition-all',
              open
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full px-1 shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {open && (
            <div
              ref={panelRef}
              className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[520px] flex flex-col bg-card/95 backdrop-blur-md rounded-2xl border border-border/40 shadow-soft overflow-hidden z-50"
              style={{ animation: 'fadeSlideDown 0.15s ease-out' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">{t('notifications.title')}</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> {t('notifications.all_read_btn')}
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto flex-1">
                {loading && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">{t('notifications.loading_short')}</span>
                  </div>
                )}

                {!loading && recent.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Bell className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">{t('notifications.caught_up')}</p>
                    <p className="text-xs opacity-70">{t('notifications.no_notifs_right_now')}</p>
                  </div>
                )}

                {!loading && recent.map((n, i) => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) markRead(n.id) }}
                    className={cn(
                      'w-full text-left flex items-start gap-3.5 px-5 py-4 border-b border-border/30 last:border-0 transition-all group',
                      n.is_read
                        ? 'opacity-70 hover:bg-accent/40'
                        : 'bg-primary/3 hover:bg-primary/8'
                    )}
                  >
                    {/* Icon bubble */}
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', notifColor(n.message))}>
                      {notifIcon(n.message)}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <p className={cn(
                        'text-sm leading-snug',
                        n.is_read ? 'text-muted-foreground font-normal' : 'text-foreground font-semibold'
                      )}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                        <span className="text-[10px] font-medium text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>

                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="text-xs font-bold text-primary hover:text-primary/80 transition-colors w-full flex items-center justify-center gap-1 p-2 rounded-xl hover:bg-primary/5"
                >
                  {t('notifications.view_all')}
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-[0.98]">
          <div className="w-8 h-8 rounded-xl shadow-glow bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">
            {getInitials(user.firstName, user.lastName)}
          </div>
          <span className="hidden md:block text-xs font-bold text-foreground">
            {user.firstName}
          </span>
        </Link>
      </div>
    </header>
  )
}
