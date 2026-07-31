import { cn } from '@/lib/utils'
import {
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  CATEGORY_LABELS, ROLE_LABELS, ROLE_COLORS,
  INTERVENTION_STATUS_LABELS, INTERVENTION_STATUS_COLORS,
} from '@/lib/helpers'
import type { TicketStatus, TicketPriority, TicketCategory, Role, InterventionStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: TicketStatus
  size?: 'sm' | 'md'
}
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium border rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
      STATUS_COLORS[status]
    )}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface PriorityBadgeProps {
  priority: TicketPriority
  size?: 'sm' | 'md'
}
export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium border rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
      PRIORITY_COLORS[priority]
    )}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

interface CategoryBadgeProps {
  category: TicketCategory
  size?: 'sm' | 'md'
}
export function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-medium bg-secondary text-secondary-foreground border border-border rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
    )}>
      {CATEGORY_LABELS[category]}
    </span>
  )
}

interface RoleBadgeProps { role: Role }
export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5',
      ROLE_COLORS[role]
    )}>
      {ROLE_LABELS[role]}
    </span>
  )
}

interface InterventionBadgeProps { status: InterventionStatus }
export function InterventionBadge({ status }: InterventionBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5',
      INTERVENTION_STATUS_COLORS[status]
    )}>
      {INTERVENTION_STATUS_LABELS[status]}
    </span>
  )
}
