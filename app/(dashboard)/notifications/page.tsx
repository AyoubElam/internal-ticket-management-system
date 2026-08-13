'use client'

import { Bell, Check, CheckCheck, Ticket, Wrench, Star, Info, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/helpers'
import { useNotifications } from '@/lib/notifications-context'
import { useLanguage } from '@/lib/i18n/language-context'

function notifIcon(message: string) {
  const m = message.toLowerCase()
  if (m.includes('ticket')) return <Ticket className="w-5 h-5" />
  if (m.includes('intervention') || m.includes('technician') || m.includes('assign')) return <Wrench className="w-5 h-5" />
  if (m.includes('rating') || m.includes('star')) return <Star className="w-5 h-5" />
  if (m.includes('resolved') || m.includes('closed')) return <CheckCheck className="w-5 h-5" />
  return <Info className="w-5 h-5" />
}

function notifColor(message: string) {
  const m = message.toLowerCase()
  if (m.includes('ticket')) return 'bg-blue-500/15 text-blue-500'
  if (m.includes('intervention') || m.includes('assign')) return 'bg-violet-500/15 text-violet-500'
  if (m.includes('rating')) return 'bg-amber-400/15 text-amber-500'
  if (m.includes('resolved') || m.includes('closed')) return 'bg-emerald-500/15 text-emerald-500'
  return 'bg-muted text-muted-foreground'
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()
  const { t } = useLanguage()

  const unread = notifications.filter(n => !n.is_read)
  const read = notifications.filter(n => n.is_read)

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-card border border-border/70 rounded-3xl p-6 md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center',
            unreadCount > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('notifications.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0
                ? <><span className="font-semibold text-primary">{unreadCount}</span> {unreadCount > 1 ? t('notifications.unread_messages') : t('notifications.unread_message')}</>
                : <span className="text-emerald-600 font-medium">✓ {t('notifications.all_caught_up')}</span>}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="hidden sm:inline">{t('notifications.mark_all_read')}</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{t('notifications.loading')}</span>
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="bg-card border border-border/60 rounded-3xl flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Bell className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-foreground">{t('notifications.nothing_here')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('notifications.new_will_appear')}</p>
          </div>
        </div>
      )}

      {/* Unread Section */}
      {!loading && unread.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
            {t('notifications.new')}
          </p>
          <div className="flex flex-col gap-2">
            {unread.map(n => (
              <div
                key={n.id}
                className="group flex items-start gap-4 p-5 bg-card border border-primary/20 rounded-2xl shadow-sm hover:shadow-md transition-all relative"
              >
                {/* Unread dot */}
                <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-primary shadow-sm" />

                {/* Icon */}
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5', notifColor(n.message))}>
                  {notifIcon(n.message)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-sm font-semibold text-foreground leading-snug">{n.message}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                    <span className="text-xs font-medium text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </div>
                </div>

                {/* Mark as read */}
                <button
                  onClick={() => markRead(n.id)}
                  title="Mark as read"
                  className="absolute bottom-4 right-4 p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read Section */}
      {!loading && read.length > 0 && (
        <div className="space-y-2">
          {unread.length > 0 && (
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
              {t('notifications.earlier')}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {read.map(n => (
              <div
                key={n.id}
                className="flex items-start gap-4 p-5 bg-card/60 border border-border/40 rounded-2xl opacity-60 hover:opacity-100 transition-all"
              >
                {/* Icon */}
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 grayscale opacity-60', notifColor(n.message))}>
                  {notifIcon(n.message)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground leading-snug">{n.message}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}