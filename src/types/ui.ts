import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export type AppModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  overlayClassName?: string
  panelClassName?: string
}

export type ModalHeaderProps = {
  title: string
  subtitle?: string
  onClose: () => void
  closeDisabled?: boolean
  className?: string
  titleClassName?: string
  closeButtonClassName?: string
}

export type FloatingActionButtonProps = {
  ariaLabel: string
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  visible?: boolean
  className?: string
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: 'normal' | 'compact'
}

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone?: 'secondary' | 'foreground'
}

export type NavItem = {
  href: string
  label: string
  icon: ReactNode
}
