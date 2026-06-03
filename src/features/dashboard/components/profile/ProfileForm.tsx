'use client'

import { FormEvent, useState } from 'react'
import { PrimaryButton, TextInput } from '@/src/components/atoms/FormControls'
import type { ProfileData, ProfileFields, ProfileFormProps } from '@/src/features/dashboard/types'

export function ProfileForm({
  initialProfile,
  currentProfile,
  onSave,
}: ProfileFormProps) {
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

    const payload: ProfileData = {
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
