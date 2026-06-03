'use client'

import type { ReactNode } from 'react'

type AppModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  overlayClassName?: string
  panelClassName?: string
}

function joinClasses(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function AppModal({ open, onClose, children, overlayClassName, panelClassName }: AppModalProps) {
  if (!open) return null

  return (
    <div
      className={joinClasses(
        'fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-md p-0 sm:p-6',
        overlayClassName
      )}
      onClick={onClose}
    >
      <div
        className={joinClasses(
          'border border-border bg-muted shadow-2xl',
          panelClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

type ModalHeaderProps = {
  title: string
  subtitle?: string
  onClose: () => void
  closeDisabled?: boolean
  className?: string
  titleClassName?: string
  closeButtonClassName?: string
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  closeDisabled,
  className,
  titleClassName,
  closeButtonClassName,
}: ModalHeaderProps) {
  return (
    <div className={joinClasses('flex items-center justify-between border-b border-border bg-foreground/[0.02] p-5 sm:p-8', className)}>
      <div className="space-y-0.5 sm:space-y-1">
        <h2 className={joinClasses('text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight', titleClassName)}>{title}</h2>
        {subtitle && <p className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        className={joinClasses(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50',
          closeButtonClassName
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
