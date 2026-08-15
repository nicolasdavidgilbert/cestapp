import type { AuthCookieSettings } from '@insforge/sdk/ssr'

export const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!
export const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

const isProduction = process.env.NODE_ENV === 'production'
const cookiePrefix = isProduction ? '__Host-' : ''

export const INSFORGE_AUTH_COOKIE_SETTINGS = {
  names: {
    accessToken: `${cookiePrefix}cestapp_access`,
    refreshToken: `${cookiePrefix}cestapp_refresh`,
  },
  options: {
    accessToken: {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    },
    refreshToken: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    },
  },
} satisfies AuthCookieSettings

export const INSFORGE_SSR_CONFIG = {
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
  ...INSFORGE_AUTH_COOKIE_SETTINGS,
}
