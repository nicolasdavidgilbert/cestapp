'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/src/store/UserContext'
import { AuthLayout } from '@/src/features/auth/components/AuthLayout'
import { AuthFeedback, AuthSubmitButton } from '@/src/features/auth/components/AuthFeedback'
import { AuthFieldIcon } from '@/src/features/auth/components/AuthIcons'
import { PremiumInput } from '@/src/features/auth/components/PremiumInput'
import { ShoppingListPreview } from '@/src/features/auth/components/ShoppingListPreview'
import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'

const onboardingHighlights = [
  { title: 'Registro rápido', description: 'Empieza en menos de 1 minuto desde móvil.' },
  { title: 'Listas compartidas', description: 'Coordina compras con familia y pareja en tiempo real.' },
  { title: 'Historial de precios', description: 'Compra con mejor criterio cada semana.' },
]

const previewChecklist = [
  { label: 'Leche', quantity: '2 ud', done: true },
  { label: 'Pan', quantity: '1 ud', done: true },
  { label: 'Tomate', quantity: '4 ud', done: false },
  { label: 'Pasta', quantity: '2 paq', done: false },
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

      <ShoppingListPreview items={previewChecklist} variant="compact" animated />

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
          <AuthFeedback message={error} animated />
          <AuthFeedback message={successMessage} tone="success" />
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
              icon={<AuthFieldIcon type="user" />}
            />

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
              autoComplete="new-password"
              icon={<AuthFieldIcon type="password" />}
            />

            <AuthSubmitButton loading={loading} idleLabel="Crear Cuenta" loadingLabel="Creando cuenta..." />
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

            <AuthSubmitButton
              loading={loading}
              idleLabel="Verificar Cuenta"
              loadingLabel="Verificando..."
              disabled={code.length !== 6}
              solid
            />
            
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
