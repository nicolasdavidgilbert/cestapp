'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { App as CapacitorApp } from '@capacitor/app'
import { useUser } from '@/src/store/UserContext'
import { getInsforgeClient } from '@/src/services/insforge'
import { AuthLayout } from '@/src/features/auth/components/AuthLayout'
import { AuthFeedback, AuthSubmitButton } from '@/src/features/auth/components/AuthFeedback'
import { AuthFieldIcon, GoogleIcon } from '@/src/features/auth/components/AuthIcons'
import { PremiumInput } from '@/src/features/auth/components/PremiumInput'
import type { SignInQueryState } from '@/src/features/auth/types'
import { startOAuthWeb } from '@/src/features/auth/services/webAuthService'
import { OAUTH_CODE_VERIFIER_KEY, OAUTH_REDIRECT_PATH_KEY, canUseWebOAuth, closeOAuthBrowser, getNativeOAuthRedirectUrl, isExpectedNativeOAuthCallback, isNativeCapacitorApp, openOAuthUrlInNativeBrowser, sanitizeRedirectPath } from '@/src/features/auth/services/oauthService'

export default function SignInPage() {
  const router = useRouter()
  const { signIn, completeNativeOAuth } = useUser()
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
        authError: params.get('insforge_error')?.slice(0, 300) ?? null,
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

      if (!oauthCode || oauthCode.length > 4096) {
        setError(
          callbackError
            ? callbackError.slice(0, 300)
            : 'La respuesta OAuth no es válida. Inténtalo de nuevo.'
        )
        setLoading(false)
        void closeOAuthBrowser()
        return
      }

      processingOAuthRef.current = true
      setError('')
      setLoading(true)

      if (!codeVerifier) {
        setError('El intento OAuth ha caducado. Inténtalo de nuevo.')
        setLoading(false)
        processingOAuthRef.current = false
        return
      }

      const result = await completeNativeOAuth(oauthCode, codeVerifier)
      if (result.error) {
        setError(result.error)
        setLoading(false)
        processingOAuthRef.current = false
        return
      }

      sessionStorage.removeItem(OAUTH_REDIRECT_PATH_KEY)
      sessionStorage.removeItem(OAUTH_CODE_VERIFIER_KEY)
      localStorage.removeItem(OAUTH_CODE_VERIFIER_KEY)
      void closeOAuthBrowser()
      router.replace(nextRedirect)
    },
    [completeNativeOAuth, redirectPath, router]
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

    if (!isNativeApp) {
      const result = await startOAuthWeb(provider, redirectPath)
      if (!result.data?.url) {
        setError(result.error ?? 'No se pudo abrir Google OAuth.')
        setLoading(false)
        return
      }

      window.location.href = result.data.url
      return
    }

    sessionStorage.setItem(OAUTH_REDIRECT_PATH_KEY, redirectPath)
    const { data, error } = await getInsforgeClient().auth.signInWithOAuth(provider, {
      redirectTo: getNativeOAuthRedirectUrl(),
      skipBrowserRedirect: true,
    })

    if (error) {
      if (error.message === 'An unexpected error occurred during OAuth initialization') {
        setError('OAuth no se pudo iniciar. Usa HTTPS o abre la app en localhost.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    if (data?.codeVerifier) {
      sessionStorage.setItem(OAUTH_CODE_VERIFIER_KEY, data.codeVerifier)
      localStorage.setItem(OAUTH_CODE_VERIFIER_KEY, data.codeVerifier)
    }

    if (!data?.url) {
      setError('No se pudo abrir Google OAuth.')
      setLoading(false)
      return
    }

    try {
      await openOAuthUrlInNativeBrowser(data.url)
    } catch {
      setError('No se pudo abrir Google OAuth. Revisa que el dispositivo tenga un navegador instalado y activo.')
      setLoading(false)
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
          <AuthFeedback
            message={sessionExpired ? 'Tu sesión expiró. Inicia sesión de nuevo para continuar.' : undefined}
            tone="info"
          />
          <AuthFeedback
            message={authStatus === 'success' && authType === 'verify_email'
              ? 'Email verificado. Ya puedes iniciar sesión.'
              : undefined}
            tone="success"
          />
          <AuthFeedback
            message={authStatus === 'error' && ['verify_email', 'oauth'].includes(authType ?? '') ? authError : undefined}
          />
          <AuthFeedback message={error} animated />
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
            icon={<AuthFieldIcon type="email" />}
          />

          <PremiumInput
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            icon={<AuthFieldIcon type="password" />}
          />

          <div className="flex items-center justify-end">
            <Link href="#" className="text-xs font-medium text-muted-foreground hover:text-secondary transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <AuthSubmitButton
            loading={loading}
            idleLabel="Iniciar Sesión"
            loadingLabel="Iniciando sesión..."
          />
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
          <GoogleIcon />
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
