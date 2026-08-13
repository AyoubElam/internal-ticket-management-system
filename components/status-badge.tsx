import { cn } from '@/lib/utils'
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS, ROLE_LABELS,
  INTERVENTION_STATUS_LABELS,
} from '@/lib/helpers'
import type { TicketStatus, TicketPriority, TicketCategory, Role, InterventionStatus } from '@/lib/types'
import {
  CircleDashed, UserPlus, UserCheck, PlayCircle, CheckCircle2, CheckCircle, XCircle,
  ArrowDown, Minus, ArrowUp, AlertTriangle,
  Wifi, MapPin, Package, Key,
  CircleUser, Wrench, Shield, User, Circle
} from 'lucide-react'

const STATUS_CONFIG: Record<TicketStatus, { icon: any, color: string }> = {
  created: { icon: CircleDashed, color: 'text-slate-500' },
  pending_assignment: { icon: UserPlus, color: 'text-orange-500' },
  assigned: { icon: UserCheck, color: 'text-blue-500' },
  in_progress: { icon: PlayCircle, color: 'text-amber-500' },
  resolved: { icon: CheckCircle2, color: 'text-emerald-500' },
  closed: { icon: CheckCircle, color: 'text-slate-400' },
  cancelled: { icon: XCircle, color: 'text-rose-500' },
}

export function StatusBadge({ status, size = 'md' }: { status: TicketStatus, size?: 'sm' | 'md' }) {
  const Icon = STATUS_CONFIG[status]?.icon || Circle
  const color = STATUS_CONFIG[status]?.color || 'text-muted-foreground'
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full",
      size === 'sm' ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      color.replace('text-', 'bg-').replace('500', '500/10'),
      color
    )}>
      <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{STATUS_LABELS[status]}</span>
    </div>
  )
}

const PRIORITY_CONFIG: Record<TicketPriority, { icon: any, color: string }> = {
  low: { icon: ArrowDown, color: 'text-emerald-500' },
  medium: { icon: Minus, color: 'text-amber-500' },
  high: { icon: ArrowUp, color: 'text-orange-500' },
  critical: { icon: AlertTriangle, color: 'text-rose-500' },
}

export function PriorityBadge({ priority, size = 'md' }: { priority: TicketPriority, size?: 'sm' | 'md' }) {
  const Icon = PRIORITY_CONFIG[priority]?.icon || Circle
  const color = PRIORITY_CONFIG[priority]?.color || 'text-muted-foreground'
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full",
      size === 'sm' ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      color.replace('text-', 'bg-').replace('500', '500/10'),
      color
    )}>
      <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{PRIORITY_LABELS[priority]}</span>
    </div>
  )
}

const CATEGORY_CONFIG: Record<TicketCategory, { icon: any, color: string }> = {
  network_support: { icon: Wifi, color: 'text-blue-500' },
  field_intervention: { icon: MapPin, color: 'text-indigo-500' },
  equipment_request: { icon: Package, color: 'text-purple-500' },
  system_access: { icon: Key, color: 'text-slate-500' },
}

export function CategoryBadge({ category, size = 'md' }: { category: TicketCategory, size?: 'sm' | 'md' }) {
  const Icon = CATEGORY_CONFIG[category]?.icon || Circle
  const color = CATEGORY_CONFIG[category]?.color || 'text-muted-foreground'
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full",
      size === 'sm' ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      color.replace('text-', 'bg-').replace('500', '500/10'),
      color
    )}>
      <Icon className={size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>{CATEGORY_LABELS[category]}</span>
    </div>
  )
}

const ROLE_CONFIG: Record<Role, { icon: any, color: string }> = {
  admin: { icon: Shield, color: 'text-purple-500' },
  support_agent: { icon: CircleUser, color: 'text-blue-500' },
  technician: { icon: Wrench, color: 'text-amber-500' },
  employee: { icon: User, color: 'text-slate-500' },
}

export function RoleBadge({ role }: { role: Role }) {
  const Icon = ROLE_CONFIG[role]?.icon || Circle
  const color = ROLE_CONFIG[role]?.color || 'text-muted-foreground'
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full px-2.5 py-1 text-[11px]",
      color.replace('text-', 'bg-').replace('500', '500/10'),
      color
    )}>
      <Icon className="w-3 h-3" />
      <span>{ROLE_LABELS[role]}</span>
    </div>
  )
}

const INTERVENTION_CONFIG: Record<InterventionStatus, { icon: any, color: string }> = {
  traveling: { icon: PlayCircle, color: 'text-blue-500' },
  in_progress: { icon: PlayCircle, color: 'text-amber-500' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500' },
}

export function InterventionBadge({ status }: { status: InterventionStatus }) {
  const Icon = INTERVENTION_CONFIG[status]?.icon || Circle
  const color = INTERVENTION_CONFIG[status]?.color || 'text-muted-foreground'
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 font-semibold rounded-full px-2.5 py-1 text-[11px]",
      color.replace('text-', 'bg-').replace('500', '500/10'),
      color
    )}>
      <Icon className="w-3 h-3" />
      <span>{INTERVENTION_STATUS_LABELS[status]}</span>
    </div>
  )
}
