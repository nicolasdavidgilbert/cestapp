import { useMemo } from 'react'
import { generateCestaAvatar } from '@/src/utils/generateCestaAvatar'

/**
 * Returns the avatar URL for a user.
 * If an explicit avatarUrl is provided (e.g. from Google OAuth), it takes priority.
 * Otherwise, generates a deterministic SVG avatar from the email.
 */
export function useAvatar(email?: string | null, avatarUrl?: string | null): string {
  return useMemo(() => {
    if (avatarUrl) return avatarUrl
    return generateCestaAvatar(email || 'anonymous-user')
  }, [email, avatarUrl])
}
