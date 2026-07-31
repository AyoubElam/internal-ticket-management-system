'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/status-badge'
import { timeAgo, getInitials } from '@/lib/helpers'
import { useAuth } from '@/lib/auth-context'

type Ticket = {
  id: number
  title: string
  category: string
  priority: string
  status: string
  created_at: string
  created_by_name?: string
  assigned_to_name?: string
}

export default function TicketsPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:4000/api/tickets', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load tickets.')
        setTickets(data.data || [])
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [])

  // Backend already scopes the query by role (employees see their own,
  // technicians see only what's assigned to them) — this just mirrors
  // that in the copy/UI so it doesn't read as a bug.
  const isTechnician = user?.role === 'technician'
  const canCreate = user ? ['admin', 'support_agent', 'employee'].includes(user.role) : false

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isTechnician ? 'My Assigned Tickets' : 'Tickets'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isTechnician ? 'Tickets assigned to you' : 'All support requests'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/tickets/new"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading tickets…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  {!isTechnician && <th className="px-4 py-3 hidden lg:table-cell">Assigned To</th>}
                  <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={isTechnician ? 5 : 6} className="px-4 py-8 text-center text-muted-foreground">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  tickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-accent transition-colors">
                      <td className="px-4 py-3.5">
                        <Link href={`/tickets/${ticket.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <CategoryBadge category={ticket.category as any} size="sm" />
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={ticket.priority as any} size="sm" />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={ticket.status as any} size="sm" />
                      </td>
                      {!isTechnician && (
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          {ticket.assigned_to_name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                {getInitials(ticket.assigned_to_name.split(' ')[0], ticket.assigned_to_name.split(' ')[1] || '')}
                              </div>
                              <span className="text-xs text-foreground truncate max-w-[120px]">
                                {ticket.assigned_to_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(ticket.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}