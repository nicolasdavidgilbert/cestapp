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

export type NativeSessionResult = {
  accessToken: string
  user: unknown
}

export type NativeSignUpResult = Partial<NativeSessionResult> & {
  requireVerification?: boolean
}

export type NativeSessionPlugin = {
  migrateLegacySession: () => Promise<{ migrated: boolean }>
  signIn: (options: { email: string; password: string }) => Promise<NativeSessionResult>
  signUp: (options: { email: string; password: string; name: string }) => Promise<NativeSignUpResult>
  verifyEmail: (options: { email: string; code: string }) => Promise<NativeSessionResult>
  exchangeOAuthCode: (options: { code: string; codeVerifier: string }) => Promise<NativeSessionResult>
  refreshSession: () => Promise<NativeSessionResult>
  signOut: () => Promise<void>
  clearSession: () => Promise<void>
}

export type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean }
}

export type IOSStandaloneNavigator = Navigator & {
  standalone?: boolean
}
