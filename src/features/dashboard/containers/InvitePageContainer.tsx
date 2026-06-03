'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@/src/store/UserContext'
import { acceptListInvite, normalizeAcceptedInvite, publishInviteAcceptedEvents } from '@/src/features/dashboard/services/invitationsService'
import type { AcceptedInvite } from '@/src/features/dashboard/types'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user, loading: authLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinedList, setJoinedList] = useState<AcceptedInvite | null>(null)

  useEffect(() => {
    if (!token) return
    if (authLoading) return

    if (!user) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(`/invite/${token}`)}`)
      return
    }

    let cancelled = false

    const acceptInvite = async () => {
      setLoading(true)
      setError('')
      const { data, error } = await acceptListInvite(token)

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const accepted = normalizeAcceptedInvite(data)
      if (!accepted) {
        setError('No se pudo validar el enlace de invitación.')
        setLoading(false)
        return
      }

      setJoinedList(accepted)

      await publishInviteAcceptedEvents(accepted, user.id)

      router.replace(`/dashboard/${accepted.list_id}`)
    }

    queueMicrotask(() => {
      void acceptInvite()
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, router, token, user])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-[2.5rem] border border-border bg-card/60 p-10 backdrop-blur-xl shadow-2xl text-center space-y-8">
        {loading ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-border border-t-secondary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-secondary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Validando Invitación</h1>
                <p className="text-sm text-muted-foreground font-medium">Conectando con el servidor seguro...</p>
              </div>
            </div>
            {joinedList && (
              <p className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-bold text-primary ring-1 ring-primary/20">
                Acceso validado para: {joinedList.list_name}
              </p>
            )}
          </div>
        ) : error ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 flex items-center justify-center rounded-[1.5rem] bg-destructive/10 text-destructive ring-1 ring-destructive/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Error de Validación</h1>
                <p className="text-sm text-destructive font-medium max-w-sm mx-auto">{error}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 min-[400px]:flex-row justify-center">
              <button
                onClick={() => router.refresh()}
                className="group relative flex items-center justify-center overflow-hidden rounded-2xl bg-foreground px-8 py-4 text-sm font-bold text-background transition-all hover:scale-[1.02] active:scale-95"
              >
                Reintentar
              </button>
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center rounded-2xl border border-border bg-muted/20 px-8 py-4 text-sm font-bold text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
              >
                Volver al Panel
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
