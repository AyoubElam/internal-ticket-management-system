import type { Request } from 'express'

export type Role = 'admin' | 'support_agent' | 'technician' | 'employee'
export type TicketStatus    = 'created' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
export type TicketCategory  = 'network_support' | 'field_intervention' | 'equipment_request' | 'system_access'
export type TicketPriority  = 'low' | 'medium' | 'high' | 'critical'
export type InterventionStatus = 'traveling' | 'in_progress' | 'completed'

export interface JwtPayload {
  id: any
  userId: number
  role:   Role
  email:  string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export interface User {
  id:         number
  email:      string
  first_name: string
  last_name:  string
  role:       Role
  zone_id:    number | null
  is_active:  boolean
  created_at: Date
}

export interface Ticket {
  id:             number
  title:          string
  description:    string
  category:       TicketCategory
  priority:       TicketPriority
  status:         TicketStatus
  created_by_id:  number
  assigned_to_id: number | null
  zone_id:        number | null
  created_at:     Date
  updated_at:     Date
  resolved_at:    Date | null
}

export interface Comment {
  id:          number
  ticket_id:   number
  user_id:     number
  content:     string
  is_internal: boolean
  created_at:  Date
}

export interface Intervention {
  id:             number
  ticket_id:      number
  technician_id:  number
  status:         InterventionStatus
  notes:          string | null
  created_at:     Date
  updated_at:     Date
}

export interface PaginationQuery {
  page?:  string
  limit?: string
}
