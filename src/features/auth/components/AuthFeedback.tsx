import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/src/utils/classNames'

type AuthFeedbackTone = 'error' | 'info' | 'success'

const feedbackToneClasses: Record<AuthFeedbackTone, string> = {
  error: 'border-destructive/20 bg-destructive/10 text-destructive',
  info: 'border-secondary/20 bg-secondary/10 text-secondary',
  success: 'border-primary/20 bg-primary/10 text-primary',
}

export function AuthFeedback({
  message,
  tone = 'error',
  animated = false,
}: {
  message?: string | null
  tone?: AuthFeedbackTone
  animated?: boolean
}) {
  if (!message) return null

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm font-medium',
        feedbackToneClasses[tone],
        animated && 'animate-pulse',
      )}
    >
      {message}
    </div>
  )
}

type AuthSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  loading: boolean
  idleLabel: string
  loadingLabel: string
  solid?: boolean
}

export function AuthSubmitButton({
  loading,
  idleLabel,
  loadingLabel,
  solid = false,
  className,
  disabled,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(
        'group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl px-4 py-4 text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        solid ? 'bg-secondary' : 'bg-gradient-to-br from-secondary to-secondary/80',
        className,
      )}
      {...props}
    >
      <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative">{loading ? loadingLabel : idleLabel}</span>
    </button>
  )
}
