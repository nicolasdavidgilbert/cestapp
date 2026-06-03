'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MeshBackground } from '@/src/features/auth/components/MeshBackground'
import type { CapacitorWindow, IOSStandaloneNavigator } from '@/src/features/auth/types'

const benefits = [
  {
    title: 'Sincronización en vivo',
    description: 'Comparte listas con tu familia y observa los cambios en tiempo real sin mensajes duplicados.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    )
  },
  {
    title: 'Control de precios',
    description: 'Guarda históricos para detectar subidas y elegir siempre el mejor momento para comprar.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V18.75c0 .754-.726 1.294-1.453 1.096A60.07 60.07 0 013 18.75V10.5m18 8.25V18.75m-1.5-13.5a1.5 1.5 0 00-3 0V12m-6-4.5a1.5 1.5 0 113 0V12M9 12h12M9 12v3m0-3h1.5" />
      </svg>
    )
  },
  {
    title: 'Modo Supermercado',
    description: 'Interfaz rápida diseñada para usarse con una mano mientras recorres los pasillos.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )
  },
]

const workflowSteps = [
  'Crea tu lista semanal en segundos.',
  'Añade productos con prioridad y notas.',
  'Sincroniza con familia o pareja al instante.',
  'Revisa el historial de ahorros acumulados.',
]

const previewList = [
  { name: 'Leche semidesnatada', qty: '2 ud', done: true },
  { name: 'Huevos M (Docena)', qty: '1 ud', done: true },
  { name: 'Pasta integral', qty: '3 paq', done: false },
  { name: 'Tomate triturado', qty: '4 lat', done: false },
]

export default function HomePage() {
  const router = useRouter()
  const [canRenderLanding, setCanRenderLanding] = useState(false)

  useEffect(() => {
    const isStandaloneDisplayMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches

    const isIOSStandalone =
      'standalone' in window.navigator &&
      Boolean((window.navigator as IOSStandaloneNavigator).standalone)

    const capacitor = (window as CapacitorWindow).Capacitor

    const isCapacitor = Boolean(capacitor?.isNativePlatform?.() ?? capacitor)
    const isAppEnvironment = isStandaloneDisplayMode || isIOSStandalone || isCapacitor

    if (isAppEnvironment) {
      router.replace('/dashboard')
      return
    }

    queueMicrotask(() => {
      setCanRenderLanding(true)
    })
  }, [router])

  if (!canRenderLanding) {
    return null
  }

  return (
    <div className="relative min-h-screen text-foreground selection:bg-secondary/30 selection:text-secondary-foreground">
      <MeshBackground />
      
      {/* Header / Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-secondary/80 text-xl font-bold text-secondary-foreground shadow-lg shadow-secondary/20 ring-1 ring-border/20">
              C+
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground group-hover:text-secondary transition-colors">
              Cesta<span className="text-secondary">++</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/sign-in" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Iniciar sesión
            </Link>
            <Link 
              href="/sign-up" 
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground ring-1 ring-border/10 transition-all hover:bg-muted/80 active:scale-95"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-32 pb-24">
        {/* Hero Section */}
        <section className="grid items-center gap-16 lg:grid-cols-2 lg:py-20">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary ring-1 ring-secondary/20">
                La compra inteligente ha llegado
              </span>
              <h1 className="text-5xl font-bold leading-[1.1] text-foreground sm:text-7xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                Organiza tu hogar <br />
                <span className="text-secondary">sin stress.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Cesta++ centraliza tus listas, sincroniza a tu familia en tiempo real y guarda histórico de precios para ayudarte a ahorrar cada semana.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link 
                href="/sign-up" 
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 px-8 py-4 text-base font-bold text-secondary-foreground shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span className="absolute inset-0 bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100" />
                Empieza gratis ahora
              </Link>
              <Link 
                href="/sign-in" 
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-muted/40 px-8 py-4 text-base font-bold text-foreground backdrop-blur-sm transition-all hover:bg-muted/60 active:scale-95"
              >
                Ver demostración
              </Link>
            </div>
          </div>

          {/* Interactive Hero Preview */}
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-secondary/10 blur-[120px]" />
            <div className="relative rounded-[2.5rem] border border-border bg-muted/20 p-6 shadow-2xl backdrop-blur-2xl [background:linear-gradient(135deg,rgba(var(--foreground-rgb),0.05),rgba(var(--foreground-rgb),0.02))]">
              <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Lista Semanal</h3>
                  <p className="text-xs text-muted-foreground">Sincronizado hace un momento</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
              </div>

              <ul className="space-y-3">
                {previewList.map((item) => (
                  <li key={item.name} className="group flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-3.5 transition-all hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                        item.done 
                        ? 'border-secondary bg-secondary text-secondary-foreground' 
                        : 'border-border bg-muted/20 text-transparent'
                      }`}>
                        ✓
                      </div>
                      <span className={`text-sm font-medium transition-all ${item.done ? 'text-muted-foreground line-through decoration-secondary/50' : 'text-foreground'}`}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full">{item.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
              Mucho más que una lista.
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Diseñado para simplificar tu rutina diaria y ayudarte a tomar mejores decisiones financieras sin esfuerzo.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="group relative rounded-[2rem] border border-border bg-muted/20 p-8 backdrop-blur-sm transition-all hover:bg-muted/40 hover:-translate-y-1">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary ring-1 ring-secondary/20 group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground">{benefit.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Workflow Section */}
        <section className="relative overflow-hidden rounded-[3rem] border border-border bg-muted/10 p-8 sm:p-12 lg:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-50" />
          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                Cómo funciona
              </span>
              <h2 className="text-4xl font-bold leading-tight text-foreground">
                Menos caos en la compra, <br/>
                más control en tu bolsillo.
              </h2>
              <p className="max-w-lg text-muted-foreground">
                Pasa de la improvisación al control total en solo cuatro pasos. Cesta++ aprende de tus hábitos para simplificar cada visita al supermercado.
              </p>
              <div className="pt-4">
                <Link href="/sign-up" className="text-secondary font-bold hover:underline">
                  Empieza ahora mismo →
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-border bg-muted/20 p-5 backdrop-blur-md">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/20 text-sm font-bold text-secondary">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6 flex flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © 2026 Cesta++. Todos los derechos reservados.
          </p>
          <div className="flex gap-8 text-xs font-medium text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Términos</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
