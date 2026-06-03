'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { App as CapacitorApp } from '@capacitor/app'
import { useUser } from '@/src/store/UserContext'
import { insforge } from '@/src/services/insforge'
import { AuthLayout } from '@/src/features/auth/components/AuthLayout'
import { PremiumInput } from '@/src/features/auth/components/PremiumInput'
import type { SignInQueryState } from '@/src/features/auth/types'
import { OAUTH_CODE_VERIFIER_KEY, OAUTH_REDIRECT_PATH_KEY, canUseWebOAuth, closeOAuthBrowser, getNativeOAuthRedirectUrl, isExpectedNativeOAuthCallback, isNativeCapacitorApp, openOAuthUrlInNativeBrowser, sanitizeRedirectPath } from '@/src/features/auth/services/oauthService'

export default function SignInPage() {
  const router = useRouter()
  const { signIn, refreshUser } = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [queryState, setQueryState] = useState<SignInQueryState>({
    authStatus: null,
    authType: null,
    authError: null,
    sessionExpired: false,
    redirectPath: '/dashboard',
  })
  const processingOAuthRef = useRef(false)

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search)
      const nextRedirectPath = sanitizeRedirectPath(params.get('redirect'))

      setQueryState({
        authStatus: params.get('insforge_status'),
        authType: params.get('insforge_type'),
        authError: params.get('insforge_error'),
        sessionExpired: params.get('session_expired') === '1',
        redirectPath: nextRedirectPath,
      })
    })
  }, [])

  const { authStatus, authType, authError, sessionExpired, redirectPath } = queryState

  const handleNativeOAuthCallback = useCallback(
    async (url: string) => {
      if (processingOAuthRef.current) return

      let incomingUrl: URL
      try {
        incomingUrl = new URL(url)
      } catch {
        return
      }

      if (!isExpectedNativeOAuthCallback(incomingUrl)) {
        return
      }

      const oauthCode = incomingUrl.searchParams.get('insforge_code') ?? incomingUrl.searchParams.get('code')
      const callbackError = incomingUrl.searchParams.get('insforge_error')
      const codeVerifier =
        sessionStorage.getItem(OAUTH_CODE_VERIFIER_KEY) ?? localStorage.getItem(OAUTH_CODE_VERIFIER_KEY)
      const nextRedirect = sanitizeRedirectPath(
        incomingUrl.searchParams.get('redirect') ?? sessionStorage.getItem(OAUTH_REDIRECT_PATH_KEY) ?? redirectPath
      )

      if (!oauthCode) {
        if (callbackError) {
          setError(callbackError)
        }
        void closeOAuthBrowser()
        return
      }

      processingOAuthRef.current = true
      setError('')
      setLoading(true)

      const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(oauthCode, codeVerifier ?? undefined)

      if (exchangeError) {
        setError(exchangeError.message)
        setLoading(false)
        processingOAuthRef.current = false
        return
      }

      sessionStorage.removeItem(OAUTH_REDIRECT_PATH_KEY)
      sessionStorage.removeItem(OAUTH_CODE_VERIFIER_KEY)
      localStorage.removeItem(OAUTH_CODE_VERIFIER_KEY)
      await refreshUser()
      void closeOAuthBrowser()
      router.replace(nextRedirect)
    },
    [redirectPath, refreshUser, router]
  )

  useEffect(() => {
    if (!isNativeCapacitorApp()) return

    let removeListener: (() => Promise<void>) | null = null

    queueMicrotask(async () => {
      try {
        const launchData = await CapacitorApp.getLaunchUrl()
        if (launchData?.url) {
          await handleNativeOAuthCallback(launchData.url)
        }

        const listener = await CapacitorApp.addListener('appUrlOpen', (event) => {
          void handleNativeOAuthCallback(event.url)
        })
        removeListener = listener.remove
      } catch {
        // Ignore listener registration failures on non-native environments.
      }
    })

    return () => {
      if (removeListener) {
        void removeListener()
      }
    }
  }, [handleNativeOAuthCallback])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(redirectPath)
    }
  }

  async function handleOAuth(provider: string) {
    setError('')
    setLoading(true)

    const isNativeApp = isNativeCapacitorApp()
    if (!isNativeApp && !canUseWebOAuth()) {
      setError('Google OAuth require HTTPS si no usas localhost.')
      setLoading(false)
      return
    }

    const redirectTo = isNativeApp
      ? getNativeOAuthRedirectUrl()
      : `${window.location.origin}${redirectPath}`

    if (isNativeApp) {
      sessionStorage.setItem(OAUTH_REDIRECT_PATH_KEY, redirectPath)
    }

    const { data, error } = await insforge.auth.signInWithOAuth(
      isNativeApp
        ? {
            provider,
            redirectTo,
            skipBrowserRedirect: true,
          }
        : {
            provider,
            redirectTo,
          }
    )

    if (error) {
      if (error.message === 'An unexpected error occurred during OAuth initialization') {
        setError('OAuth no se pudo iniciar. Usa HTTPS o abre la app en localhost.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    if (isNativeApp) {
      if (data?.codeVerifier) {
        sessionStorage.setItem(OAUTH_CODE_VERIFIER_KEY, data.codeVerifier)
        localStorage.setItem(OAUTH_CODE_VERIFIER_KEY, data.codeVerifier)
      }

      if (data?.url) {
        try {
          await openOAuthUrlInNativeBrowser(data.url)
        } catch {
          setError('No se pudo abrir Google OAuth. Revisa que el dispositivo tenga un navegador instalado y activo.')
          setLoading(false)
        }
      } else {
        setError('No se pudo abrir Google OAuth en la app.')
        setLoading(false)
      }
    }
  }

  return (
    <AuthLayout 
      title="Bienvenido" 
      subtitle="Accede a tus listas y empieza a ahorrar tiempo en tus compras."
    >
      <div className="space-y-6">
        {/* Status Messages */}
        <div className="space-y-3">
          {sessionExpired && (
            <div className="rounded-2xl border border-secondary/20 bg-secondary/10 px-4 py-3 text-sm text-secondary font-medium">
              Tu sesión expiró. Inicia sesión de nuevo para continuar.
            </div>
          )}

          {authStatus === 'success' && authType === 'verify_email' && (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              Email verificado. Ya puedes iniciar sesión.
            </div>
          )}

          {authStatus === 'error' && authType === 'verify_email' && authError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
              {authError}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium animate-pulse">
              {error}
            </div>
          )}
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <PremiumInput
            label="Correo Electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@ejemplo.com"
            required
            autoComplete="email"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            }
          />

          <PremiumInput
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
          />

          <div className="flex items-center justify-end">
            <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-secondary transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-4 py-4 text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="relative flex items-center gap-4">
          <div className="h-px flex-1 bg-border/20" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">O continuar con</span>
          <div className="h-px flex-1 bg-border/20" />
        </div>

        <button
          onClick={() => handleOAuth('google')}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground transition-all hover:bg-muted/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </button>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link
            href={redirectPath === '/dashboard' ? '/sign-up' : `/sign-up?redirect=${encodeURIComponent(redirectPath)}`}
            className="font-bold text-secondary hover:opacity-80 transition-all"
          >
            Regístrate ahora
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
