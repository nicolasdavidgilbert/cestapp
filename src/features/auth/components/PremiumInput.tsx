'use client'

import type { PremiumInputProps } from '@/src/features/auth/types'

export function PremiumInput({ label, error, icon, ...props }: PremiumInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-secondary">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`w-full rounded-2xl border bg-muted/20 px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground hover:bg-muted/30 focus:bg-muted/50 ${
            icon ? 'pl-11' : 'pl-4'
          } ${
            error 
              ? 'border-destructive/50 focus:border-destructive focus:ring-4 focus:ring-destructive/10' 
              : 'border-border focus:border-secondary focus:ring-4 focus:ring-secondary/10'
          }`}
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] opacity-50" />
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
