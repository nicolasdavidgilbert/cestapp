'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/src/store/UserContext'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { ProfileForm } from '@/src/features/dashboard/components/profile/ProfileForm'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading, signOut, updateProfile, themePreference, setThemePreference } = useUser()
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState('')
  const [themeSuccess, setThemeSuccess] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in')
    }
  }, [loading, user, router])

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
  }

  async function handleThemeChange(nextTheme: 'light' | 'dark') {
    if (savingTheme || nextTheme === themePreference) return

    setSavingTheme(true)
    setThemeError('')
    setThemeSuccess('')

    const result = await setThemePreference(nextTheme)
    if (result.error) {
      setThemeError(result.error)
    } else {
      setThemeSuccess('Preferencia de tema guardada.')
    }

    setSavingTheme(false)
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-secondary" />
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Sincronizando perfil</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen w-full px-4 sm:px-6 py-8 pb-40">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <header className="space-y-6">
            <div className="space-y-1.5 px-1">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60">
                Perfil
              </h1>
              <p className="max-w-2xl text-sm font-medium tracking-tight text-muted-foreground">
                Gestiona las preferencias de tu cuenta.
              </p>
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-8">
              <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Configuración Pública</span>
                <ProfileForm
                  key={`${user.id}:${user.updatedAt || 'static'}`}
                  initialProfile={{
                    name: typeof user.profile?.name === 'string' ? user.profile.name : '',
                    avatar_url: typeof user.profile?.avatar_url === 'string' ? user.profile.avatar_url : '',
                    bio: typeof user.profile?.bio === 'string' ? user.profile.bio : '',
                  }}
                  currentProfile={user.profile || {}}
                  onSave={updateProfile}
                />
              </section>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md space-y-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Detalles de Cuenta</span>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tema</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      disabled={savingTheme}
                      className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                        themePreference === 'light'
                          ? 'border-secondary/40 bg-secondary/15 text-secondary'
                          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      Claro
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      disabled={savingTheme}
                      className={`rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                        themePreference === 'dark'
                          ? 'border-secondary/40 bg-secondary/15 text-secondary'
                          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      Oscuro
                    </button>
                  </div>
                  {themeError && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive">
                      {themeError}
                    </div>
                  )}
                  {themeSuccess && (
                    <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-medium text-primary">
                      {themeSuccess}
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/30" />

                <div className="space-y-4">
                  {[
                    { label: 'Correo Electrónico', value: user.email },
                    { label: 'Identificador Único', value: user.id },
                    { label: 'Estado de Verificación', value: user.emailVerified ? 'Verificado' : 'Pendiente' },
                    { label: 'Método de Acceso', value: user.providers?.join(', ') || 'N/A' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1.5 group">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{item.label}</p>
                      <div className="rounded-2xl border border-border bg-muted/20 px-5 py-3.5 text-sm font-medium text-foreground/80 ring-1 ring-border/20 transition-all group-hover:bg-muted/40 group-hover:text-foreground break-all sm:truncate">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-border">
                  <button
                    onClick={handleSignOut}
                    className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-destructive/20 bg-destructive/5 py-4 text-sm font-bold text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground active:scale-95"
                  >
                    Cerrar Sesión Activa
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        <MobileDashboardNav />
      </main>
    </>
  )
}
