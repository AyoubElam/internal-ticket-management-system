import type { TicketStatus, TicketCategory, TicketPriority, InterventionStatus, Role } from './types'

export const STATUS_LABELS: Record<TicketStatus, string> = {
  created:     'Created',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
  cancelled:   'Cancelled',
}

export const STATUS_COLORS: Record<TicketStatus, string> = {
  created:     'bg-slate-500/20 text-slate-400 border-slate-500/30',
  assigned:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  resolved:    'bg-green-500/20 text-green-400 border-green-500/30',
  closed:      'bg-slate-600/20 text-slate-500 border-slate-600/30',
  cancelled:   'Cancelled',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:      'bg-green-500/20 text-green-400 border-green-500/30',
  medium:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  network_support:    'Network Support',
  field_intervention: 'Field Intervention',
  equipment_request:  'Equipment Request',
  system_access:      'System Access',
}

export const CATEGORY_ICONS: Record<TicketCategory, string> = {
  network_support:    'wifi',
  field_intervention: 'wrench',
  equipment_request:  'package',
  system_access:      'lock',
}

export const INTERVENTION_STATUS_LABELS: Record<InterventionStatus, string> = {
  traveling:   'Traveling',
  in_progress: 'In Progress',
  completed:   'Completed',
}

export const INTERVENTION_STATUS_COLORS: Record<InterventionStatus, string> = {
  traveling:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed:   'bg-green-500/20 text-green-400 border-green-500/30',
}

export const ROLE_LABELS: Record<Role, string> = {
  admin:         'Administrator',
  support_agent: 'Support Agent',
  technician:    'Technician',
  employee:      'Employee',
}

export const ROLE_COLORS: Record<Role, string> = {
  admin:         'bg-purple-500/20 text-purple-400 border-purple-500/30',
  support_agent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  technician:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  employee:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
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
