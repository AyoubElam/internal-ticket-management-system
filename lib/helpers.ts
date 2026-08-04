import type { TicketStatus, TicketCategory, TicketPriority, InterventionStatus, Role } from './types'

export const STATUS_LABELS: Record<TicketStatus, string> = {
  created:            'Created',
  pending_assignment: 'Pending Acceptance',
  assigned:            'Assigned',
  in_progress:         'In Progress',
  resolved:            'Resolved',
  closed:              'Closed',
  cancelled:           'Cancelled',
}

export const STATUS_COLORS: Record<TicketStatus, string> = {
  created:             'bg-slate-100 text-slate-700 border-slate-200',
  pending_assignment:  'bg-orange-100 text-orange-700 border-orange-200',
  assigned:            'bg-blue-100 text-blue-700 border-blue-200',
  in_progress:         'bg-amber-100 text-amber-700 border-amber-200',
  resolved:            'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed:              'bg-slate-200 text-slate-600 border-slate-300',
  // BUG FIX: this was the literal string 'Cancelled' instead of color
  // classes — StatusBadge would've rendered the word "Cancelled" as a
  // broken className on any cancelled ticket. Not something I introduced,
  // just noticed while wiring up the new status.
  cancelled:            'bg-rose-100 text-rose-700 border-rose-200',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium:   'bg-amber-100 text-amber-700 border-amber-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  network_support:    'Network Support',
  field_intervention: 'Field Intervention',
  equipment_request:  'Equipment Request',
  system_access:      'System Access',
}

export const CATEGORY_ICONS: Record<TicketCategory, string> = {
  network_support:    'router',
  field_intervention: 'hammer',
  equipment_request:  'package',
  system_access:      'key',
}

export const INTERVENTION_STATUS_LABELS: Record<InterventionStatus, string> = {
  traveling:   'Traveling',
  in_progress: 'In Progress',
  completed:   'Completed',
}

export const INTERVENTION_STATUS_COLORS: Record<InterventionStatus, string> = {
  traveling:   'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed:   'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export const ROLE_LABELS: Record<Role, string> = {
  admin:         'Administrator',
  support_agent: 'Support Agent',
  technician:    'Technician',
  employee:      'Employee',
}

export const ROLE_COLORS: Record<Role, string> = {
  admin:         'bg-purple-100 text-purple-700 border-purple-200',
  support_agent: 'bg-blue-100 text-blue-700 border-blue-200',
  technician:    'bg-amber-100 text-amber-700 border-amber-200',
  employee:      'bg-slate-100 text-slate-700 border-slate-200',
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase()
}