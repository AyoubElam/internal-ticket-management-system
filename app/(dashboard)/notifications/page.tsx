'use client'

import { Bell, Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/helpers'
import { useNotifications } from '@/lib/notifications-context'

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading notifications…</p>}

      {!loading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn(
                  'w-full text-left px-5 py-4 flex items-start gap-3 transition-colors',
                  n.is_read ? 'hover:bg-accent' : 'bg-primary/5 hover:bg-primary/10'
                )}
              >
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
                <div className={cn('flex-1 min-w-0', !!n.is_read && 'ml-5')}>
                  <p className={cn('text-sm', n.is_read ? 'text-muted-foreground' : 'text-foreground font-medium')}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <Check className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-1" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}