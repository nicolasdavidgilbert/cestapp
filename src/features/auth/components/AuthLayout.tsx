'use client'

import type { AuthLayoutProps } from '@/src/features/auth/types'
import Link from 'next/link'
import { MeshBackground } from './MeshBackground'

export function AuthLayout({ children, title, subtitle, marketing }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen selection:bg-secondary/30">
      <MeshBackground />
      
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-4 py-12">
        {/* Logo/Branding */}
        <Link href="/" className="group mb-12 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-2xl font-bold text-secondary-foreground shadow-lg shadow-secondary/20 ring-1 ring-border/20">
            C+
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-secondary">
            Cesta<span className="text-secondary">++</span>
          </span>
        </Link>

        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-12 lg:items-center">
          {/* Main Card */}
          <section className="lg:col-span-6 xl:col-span-5">
            <div className="bg-muted backdrop-blur-2xl border border-border shadow-2xl rounded-[2.5rem] p-8 sm:p-10">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                  {title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {subtitle}
                </p>
              </div>
              
              {children}
            </div>
          </section>

          {/* Marketing/Preview Section */}
          <section className="hidden lg:col-span-6 lg:block xl:col-start-8 xl:col-span-5">
            {marketing ? (
              marketing
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary ring-1 ring-secondary/20">
                    Proxima generación
                  </span>
                  <h2 className="text-4xl font-bold leading-[1.1] text-foreground bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                    Tu compra, <br />
                    mas inteligente que nunca.
                  </h2>
                  <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                    Únete a miles de personas que ahorran tiempo y dinero cada semana con nuestras listas inteligentes.
                  </p>
                </div>

                <div className="relative aspect-square max-w-sm">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-secondary/20 blur-[100px]" />
                  <div className="bg-muted border border-border shadow-2xl relative h-full w-full rounded-[3rem] p-1 overflow-hidden">
                    <div className="h-full w-full rounded-[2.8rem] bg-background border border-border p-6 animate-pulse">
                      {/* App Preview Mockup */}
                      <div className="mb-6 flex items-center justify-between">
                        <div className="h-2 w-16 rounded-full bg-muted/40" />
                        <div className="h-2 w-8 rounded-full bg-muted/40" />
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-4 rounded-2xl bg-muted/40 p-4 border border-border">
                            <div className="h-8 w-8 rounded-lg bg-secondary/20" />
                            <div className="flex-1 space-y-2">
                              <div className="h-2 w-1/2 rounded-full bg-muted/40" />
                              <div className="h-2 w-1/3 rounded-full bg-muted/20" />
                            </div>
                            <div className="h-4 w-4 rounded bg-secondary/20" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
