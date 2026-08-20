export type Role = 'admin' | 'support_agent' | 'technician' | 'employee'

export type TicketStatus = 'created' | 'pending_assignment' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'

// Category is now dynamic (backed by the `categories` table) rather than a
// fixed union — new categories can be added via the DB with zero frontend
// deploys. Validity is enforced server-side (resolveCategoryId in
// tickets_controller.ts), not by the type system. Use the `Category`
// interface below when you need the full object (label, sla, etc.) — this
// alias just documents that a plain string here is a category slug.
export type TicketCategory = string

export interface Category {
  id: number
  slug: string
  label: string
  slaHours: number | null
  isActive: boolean
  sortOrder: number
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type InterventionStatus = 'traveling' | 'in_progress' | 'completed'
// lib/types.ts


export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  role: Role
  zoneId: number | null
  isActive: boolean
  createdAt: string
  avatarInitials?: string
}

export interface Zone {
  id: number
  name: string
  region: string
  createdAt: string
}

export interface Ticket {
  id: number
  title: string
  description: string
  category: TicketCategory
  categoryLabel?: string
  priority: TicketPriority
  status: TicketStatus
  createdById: number
  assignedToId: number | null
  zoneId: number | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  createdBy?: User
  assignedTo?: User
  zone?: Zone
  commentsCount?: number
}

export interface Comment {
  id: number
  ticketId: number
  userId: number
  content: string
  isInternal: boolean
  createdAt: string
  user?: User
}

export interface Intervention {
  id: number
  ticketId: number
  technicianId: number
  status: InterventionStatus
  notes: string | null
  createdAt: string
  updatedAt: string
  ticket?: Ticket
  technician?: User
}

export interface Notification {
  id: number
  userId: number
  message: string
  isRead: boolean
  createdAt: string
}

export interface ActivityLog {
  id: number
  userId: number
  action: string
  entityType: string
  entityId: number
  details: string
  createdAt: string
  user?: User
}

export interface KpiStats {
  totalTickets: number
  openTickets: number
  resolvedToday: number
  avgResolutionHours: number
  criticalOpen: number
  slaCompliance: number
  byCategory: { category: TicketCategory; count: number }[]
  byStatus: { status: TicketStatus; count: number }[]
  byPriority: { priority: TicketPriority; count: number }[]
  ticketsOverTime: { date: string; created: number; resolved: number }[]
}

export interface AuthUser extends User {
  token: string
}