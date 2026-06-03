'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import MobileDashboardNav from '@/app/dashboard/_components/MobileDashboardNav'
import { PrimaryButton, TextInput } from '@/components/ui/FormControls'

type ProfileFields = {
  name: string
  avatar_url: string
  bio: string
}

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

function ProfileForm({
  initialProfile,
  currentProfile,
  onSave,
}: {
  initialProfile: ProfileFields
  currentProfile: Record<string, unknown>
  onSave: (profile: Record<string, unknown>) => Promise<{ error?: string }>
}) {
  const [profile, setProfile] = useState<ProfileFields>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const inputClassName = "w-full rounded-2xl border border-border bg-muted/20 px-5 sm:px-6 py-3.5 sm:py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-secondary/40 focus:bg-muted/40 focus:ring-4 focus:ring-secondary/10"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const payload: Record<string, unknown> = {
      ...currentProfile,
      name: profile.name.trim(),
      bio: profile.bio.trim(),
    }

    const avatar = profile.avatar_url.trim()
    if (avatar) {
      payload.avatar_url = avatar
    } else {
      delete payload.avatar_url
    }

    const result = await onSave(payload)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Tus cambios se han sincronizado correctamente.')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="grid gap-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            <div className="relative group flex justify-center sm:justify-start">
              <div className="h-28 w-28 rounded-3xl overflow-hidden ring-4 ring-border/20 bg-muted/30 flex items-center justify-center transition-all group-hover:ring-secondary/30">
                {profile.avatar_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  </>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-muted-foreground">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground ml-1">Nombre Completo</label>
                <TextInput
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Cómo te llamas..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground ml-1">URL de Avatar</label>
                <TextInput
                  type="url"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile((prev) => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="https://tu-imagen.jpg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground ml-1">Biografía Breve</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
            className={`${inputClassName} h-32 resize-none`}
            placeholder="Cuenta algo sobre ti..."
          />
        </div>
      </div>

      <div className="pt-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm font-medium text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-6 py-4 text-sm font-medium text-primary">
            {success}
          </div>
        )}

        <PrimaryButton type="submit" disabled={saving} className="w-full px-8 sm:w-auto">
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </PrimaryButton>
      </div>
    </form>
  )
}
