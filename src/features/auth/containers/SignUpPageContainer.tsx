'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/src/store/UserContext'
import { AuthLayout } from '@/src/features/auth/components/AuthLayout'
import { PremiumInput } from '@/src/features/auth/components/PremiumInput'
import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'

const onboardingHighlights = [
  { title: 'Registro rápido', description: 'Empieza en menos de 1 minuto desde móvil.' },
  { title: 'Listas compartidas', description: 'Coordina compras con familia y pareja en tiempo real.' },
  { title: 'Historial de precios', description: 'Compra con mejor criterio cada semana.' },
]

const previewChecklist = [
  { item: 'Leche', qty: '2 ud', done: true },
  { item: 'Pan', qty: '1 ud', done: true },
  { item: 'Tomate', qty: '4 ud', done: false },
  { item: 'Pasta', qty: '2 paq', done: false },
]

export default function SignUpPage() {
  const router = useRouter()
  const { signUp, verifyEmail } = useUser()
  const initialSearchParams =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [redirectPath] = useState<string>(() => sanitizeRedirectPath(initialSearchParams?.get('redirect')))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signUp(email, password, name)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.requireVerification) {
      setShowVerification(true)
      setLoading(false)
    } else {
      router.push(redirectPath)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await verifyEmail(email, code)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccessMessage('Email verificado. Redirigiendo...')
      router.push(redirectPath)
    }
  }

  const marketingElement = (
    <div className="space-y-8">
      <div className="space-y-4">
        <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary ring-1 ring-secondary/20">
          Experiencia de compra
        </span>
        <h2 className="text-4xl font-bold leading-[1.1] text-foreground bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
          Organiza tu hogar <br />
          en segundos.
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
          Cesta++ está diseñada para el día a día: crea listas, comparte y ahorra tiempo.
        </p>
      </div>

      {/* Interactive Preview */}
      <div className="bg-muted backdrop-blur-2xl border border-border shadow-2xl rounded-[2.5rem] p-6 animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground uppercase tracking-widest">Lista Semanal</p>
          <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">4 items</span>
        </div>
        <ul className="space-y-3">
          {previewChecklist.map((row) => (
            <li
              key={row.item}
              className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-lg border text-[10px] font-bold transition-all ${
                    row.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted/20 text-transparent'
                  }`}
                >
                  ✓
                </div>
                <span
                  className={`text-sm font-medium transition-all ${
                    row.done ? 'text-muted-foreground line-through decoration-secondary/50' : 'text-foreground'
                  }`}
                >
                  {row.item}
                </span>
              </div>
              <span className="text-[11px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">{row.qty}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {onboardingHighlights.map((h) => (
          <div key={h.title} className="rounded-2xl border border-border bg-muted/20 p-4 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">{h.title}</h3>
            <p className="text-[10px] leading-relaxed text-muted-foreground">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <AuthLayout
      title={showVerification ? 'Verifica tu cuenta' : 'Crear Cuenta'}
      subtitle={
        showVerification 
          ? 'Introduce el código que enviamos a tu correo.' 
          : 'Únete hoy y empieza a gestionar tus compras como un profesional.'
      }
      marketing={marketingElement}
    >
      <div className="space-y-6">
        {/* Messages */}
        <div className="space-y-3">
          {error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium animate-pulse">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {successMessage}
            </div>
          )}
        </div>

        {!showVerification ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <PremiumInput
              label="Nombre completo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
              autoComplete="name"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              }
            />

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
              autoComplete="new-password"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-4 py-4 text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="rounded-2xl border border-border bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Hemos enviado un código a <br />
                <strong className="text-foreground">{email}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center block">
                Código de verificación
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full tracking-[1em] text-center font-mono text-3xl font-bold rounded-2xl border border-border bg-muted/20 px-4 py-5 text-foreground outline-none transition-all placeholder:text-muted-foreground/30 focus:border-secondary focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"
                maxLength={6}
                placeholder="000000"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-secondary px-4 py-4 text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
              {loading ? 'Verificando...' : 'Verificar Cuenta'}
            </button>
            
            <button 
              type="button"
              onClick={() => setShowVerification(false)}
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver al registro
            </button>
          </form>
        )}

        {!showVerification && (
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{' '}
            <Link
              href={redirectPath === '/dashboard' ? '/sign-in' : `/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
              className="font-bold text-secondary hover:opacity-80 transition-all"
            >
              Inicia sesión
            </Link>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
