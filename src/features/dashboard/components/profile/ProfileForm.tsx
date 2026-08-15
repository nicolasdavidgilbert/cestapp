'use client'

import { FormEvent, useState } from 'react'
import { PrimaryButton, TextInput } from '@/src/components/atoms/FormControls'
import { UserAvatar } from '@/src/components/atoms/UserAvatar'
import type { ProfileData, ProfileFields, ProfileFormProps } from '@/src/features/dashboard/types'

export function ProfileForm({
  initialProfile,
  currentProfile,
  email,
  onSave,
}: ProfileFormProps) {
  const [profile, setProfile] = useState<ProfileFields>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const payload: ProfileData = {
      ...currentProfile,
      name: profile.name,
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
              <UserAvatar
                email={email}
                avatarUrl={profile.avatar_url}
                size={112}
                className="rounded-3xl ring-4 ring-border/20 transition-all group-hover:ring-secondary/30"
              />
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
            </div>
          </div>
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
