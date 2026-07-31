import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'default'
  trend?: { value: number; label: string }
}

const COLOR_MAP = {
  blue:    'bg-blue-500/10 text-blue-400',
  green:   'bg-green-500/10 text-green-400',
  amber:   'bg-amber-500/10 text-amber-400',
  red:     'bg-red-500/10 text-red-400',
  purple:  'bg-purple-500/10 text-purple-400',
  default: 'bg-muted text-muted-foreground',
}

export default function StatCard({ title, value, subtitle, icon, color = 'default', trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', COLOR_MAP[color])}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs">
          <span className={cn('font-semibold', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
