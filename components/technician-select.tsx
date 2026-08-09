'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, UserPlus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/helpers'

type Technician = { id: number; first_name: string; last_name: string }

type TechnicianSelectProps = {
  technicians: Technician[]
  value?: number | null
  placeholder?: string
  disabled?: boolean
  onSelect: (technicianId: number) => void
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
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
              {getInitials(selected.first_name, selected.last_name)}
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
          {technicians.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground text-center">No technicians available</p>
          )}
          {technicians.map(tech => {
            const isSelected = tech.id === value
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
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                  {getInitials(tech.first_name, tech.last_name)}
                </span>
                <span className="truncate flex-1">{tech.first_name} {tech.last_name}</span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}