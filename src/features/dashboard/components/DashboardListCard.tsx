import { memo } from 'react'
import Link from 'next/link'
import type { DashboardListCardProps } from '@/src/features/dashboard/types'

export const DashboardListCard = memo(function DashboardListCard({ list }: DashboardListCardProps) {
  return (
    <Link
      href={`/dashboard/${list.id}`}
      className="group relative overflow-hidden rounded-[2rem] border border-border bg-muted/20 p-6 backdrop-blur-sm transition-all hover:bg-muted/40 hover:-translate-y-1 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary/70">Lista de compra</p>
          <h3 className="text-xl font-bold text-foreground group-hover:text-secondary transition-colors">{list.name}</h3>
        </div>
        {list.access === 'owner' ? (
          <span className="rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary ring-1 ring-secondary/20">
            Propia
          </span>
        ) : (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/20">
            Compartida
          </span>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
          {list.access === 'owner'
            ? 'Gestiona y compra en tiempo real'
            : `Editor (${list.role || 'colaborador'})`}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-foreground/30 group-hover:bg-secondary/20 group-hover:text-secondary transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  )
})
