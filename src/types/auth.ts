export type ThemePreference = 'light' | 'dark'

export type UserProfile = {
  name?: string
  avatar_url?: string
  theme?: ThemePreference
  [key: string]: unknown
}

export type User = {
  id: string
  email: string
  emailVerified?: boolean
  providers?: string[]
  createdAt?: string
  updatedAt?: string
  profile?: UserProfile | null
  metadata?: Record<string, unknown> | null
  name?: string
}

export type UserContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string; requireVerification?: boolean }>
  signOut: () => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<{ error?: string }>
  completeNativeOAuth: (code: string, codeVerifier: string) => Promise<{ error?: string }>
  refreshUser: () => Promise<void>
  updateProfile: (profile: Record<string, unknown>) => Promise<{ error?: string }>
  themePreference: ThemePreference
  setThemePreference: (theme: ThemePreference) => Promise<{ error?: string }>
}

export type RefreshResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'transient' }

export type ErrorLike = {
  statusCode?: unknown
  error?: unknown
  code?: unknown
  message?: unknown
}

export type AuthErrorLike = {
  status?: number
  statusCode?: number
  error?: unknown
  message?: string
}

export type UserProviderProps = {
  children: import('react').ReactNode
}
