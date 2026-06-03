import { useAvatar } from '@/src/hooks/useAvatar'

type UserAvatarProps = {
  email?: string | null
  avatarUrl?: string | null
  size?: number
  className?: string
}

/**
 * Renders a user avatar. Shows the OAuth/profile image if available,
 * otherwise generates a deterministic Cesta++ avatar from the email.
 */
export function UserAvatar({ email, avatarUrl, size = 112, className = '' }: UserAvatarProps) {
  const resolvedUrl = useAvatar(email, avatarUrl)

  return (
    <div
      className={`overflow-hidden bg-muted/30 flex items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedUrl}
        alt="Avatar"
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </div>
  )
}
