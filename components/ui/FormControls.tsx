import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

function joinClasses(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: 'normal' | 'compact'
}

export function TextInput({ className, inputSize = 'normal', ...props }: TextInputProps) {
  return (
    <input
      className={joinClasses(
        'w-full rounded-2xl border border-border bg-muted/40 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-secondary/40 focus:bg-muted/60 focus:ring-4 focus:ring-secondary/5',
        inputSize === 'compact' ? 'px-4 py-2' : 'px-6 py-4',
        className
      )}
      {...props}
    />
  )
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone?: 'secondary' | 'foreground'
}

export function PrimaryButton({ children, className, tone = 'secondary', ...props }: PrimaryButtonProps) {
  const toneClass =
    tone === 'foreground'
      ? 'bg-foreground text-background'
      : 'bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-xl shadow-secondary/20'

  return (
    <button
      className={joinClasses(
        'group relative flex items-center justify-center overflow-hidden rounded-2xl px-6 py-4 text-base font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100',
        toneClass,
        className
      )}
      {...props}
    >
      <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative">{children}</span>
    </button>
  )
}
