'use client'

import type { ButtonHTMLAttributes } from 'react'

type FloatingActionButtonProps = {
  ariaLabel: string
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  visible?: boolean
  className?: string
}

export function FloatingActionButton({ ariaLabel, onClick, visible = true, className = '' }: FloatingActionButtonProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/40 transition-all hover:scale-110 active:scale-90 sm:hidden ${className}`.trim()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  )
}
