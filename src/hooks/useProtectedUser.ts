'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/src/store/UserContext'

export function useProtectedUser(signInPath = '/sign-in') {
  const router = useRouter()
  const userContext = useUser()

  useEffect(() => {
    if (!userContext.loading && !userContext.user) {
      router.replace(signInPath)
    }
  }, [router, signInPath, userContext.loading, userContext.user])

  return userContext
}
