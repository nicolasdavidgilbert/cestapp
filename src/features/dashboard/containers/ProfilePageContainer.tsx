'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MobileDashboardNav from '@/src/layout/MobileDashboardNav'
import { ProfileForm } from '@/src/features/dashboard/components/profile/ProfileForm'
import { Toast } from '@/src/components/atoms/Toast'
import { ProtectedPageLoader } from '@/src/components/atoms/AsyncPageState'
import { useProtectedUser } from '@/src/hooks/useProtectedUser'
import { useTimedValue } from '@/src/hooks/useTimedValue'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading, signOut, updateProfile, themePreference, setThemePreference } = useProtectedUser()
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState('')
  const { value: themeSuccess, show: showThemeSuccess, clear: clearThemeSuccess } = useTimedValue('', 1800)

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
  }

  async function handleThemeChange(nextTheme: 'light' | 'dark') {
    if (savingTheme || nextTheme === themePreference) return

    setSavingTheme(true)
    setThemeError('')
    clearThemeSuccess()

    const result = await setThemePreference(nextTheme)
    if (result.error) {
      setThemeError(result.error)
    } else {
      showThemeSuccess('Tema actualizado')
    }

    setSavingTheme(false)
  }

  if (loading || !user) {
    return <ProtectedPageLoader label="Sincronizando perfil" />
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

          <div className="grid gap-6 lg:gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6 lg:space-y-8">
              <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Configuración Pública</span>
                <ProfileForm
                  key={`${user.id}:${user.updatedAt || 'static'}`}
                  email={user.email}
                  initialProfile={{
                    name: typeof user.profile?.name === 'string' ? user.profile.name : '',
                    avatar_url: typeof user.profile?.avatar_url === 'string' ? user.profile.avatar_url : '',
                  }}
                  currentProfile={user.profile || {}}
                  onSave={updateProfile}
                />
              </section>

              <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md space-y-4">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Preferencia de Tema</span>
                  <div className="grid grid-cols-2 gap-2 pt-2">
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
                </div>
              </section>
            </div>

            <div className="lg:col-span-2 space-y-6 lg:space-y-8">
              <section className="rounded-3xl sm:rounded-[2.5rem] border border-border bg-muted/20 p-6 sm:p-10 backdrop-blur-md space-y-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary ml-1">Detalles de Cuenta</span>
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

        <Toast message={themeSuccess} />

        <MobileDashboardNav />
      </main>
    </>
  )
}
