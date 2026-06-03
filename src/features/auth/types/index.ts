import type { InputHTMLAttributes, ReactNode } from 'react'

export type AuthLayoutProps = {
  children: ReactNode
  title: string
  subtitle: string
  marketing?: ReactNode
}

export type PremiumInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  icon?: ReactNode
}

export type SignInQueryState = {
  authStatus: string | null
  authType: string | null
  authError: string | null
  sessionExpired: boolean
  redirectPath: string
}

export type NativeBrowserPlugin = {
  open: (options: NativeBrowserOpenOptions) => Promise<void>
}

export type NativeBrowserOpenOptions = {
  url: string
}

export type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean }
}

export type IOSStandaloneNavigator = Navigator & {
  standalone?: boolean
}
