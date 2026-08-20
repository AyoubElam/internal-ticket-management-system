'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, UserPlus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/helpers'

type Technician = { id: number; first_name: string; last_name: string; active_tickets?: number }

type TechnicianSelectProps = {
  technicians: Technician[]
  value?: number | null
  placeholder?: string
  disabled?: boolean
  onSelect: (technicianId: number) => void
}

// Fixed thresholds — good enough unless techs have very different capacities.
function workload(count?: number) {
  const n = count ?? 0
  if (n === 0) return { label: 'Free', dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500/10' }
  if (n <= 2)  return { label: 'Busy', dot: 'bg-amber-500',   text: 'text-amber-600',   bg: 'bg-amber-500/10' }
  return          { label: 'Overloaded', dot: 'bg-rose-500', text: 'text-rose-600',     bg: 'bg-rose-500/10' }
}

export function TechnicianSelect({
  technicians,
  value,
  placeholder = 'Select Technician…',
  disabled = false,
  onSelect,
}: TechnicianSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = technicians.find(t => t.id === value)

  // Least-loaded first, so the agent naturally lands on a free tech.
  const sorted = [...technicians].sort((a, b) => (a.active_tickets ?? 0) - (b.active_tickets ?? 0))

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl text-sm font-medium',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-60',
          open && 'ring-2 ring-primary/50'
        )}
      >
        {selected ? (
          <>
            <span className="relative w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
              {getInitials(selected.first_name, selected.last_name)}
              <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background', workload(selected.active_tickets).dot)} />
            </span>
            <span className="truncate">{selected.first_name} {selected.last_name}</span>
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{placeholder}</span>
          </>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground ml-auto transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-card border border-border/80 rounded-xl shadow-lg overflow-hidden py-1.5 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
          {sorted.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground text-center">No technicians available</p>
          )}
          {sorted.map(tech => {
            const isSelected = tech.id === value
            const w = workload(tech.active_tickets)
            return (
              <button
                key={tech.id}
                type="button"
                onClick={() => { onSelect(tech.id); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors',
                  isSelected && 'bg-accent/60'
                )}
              >
                <span className="relative w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                  {getInitials(tech.first_name, tech.last_name)}
                  <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card', w.dot)} />
                </span>
                <span className="truncate flex-1">{tech.first_name} {tech.last_name}</span>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', w.bg, w.text)}>
                  {w.label} · {tech.active_tickets ?? 0}
                </span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}