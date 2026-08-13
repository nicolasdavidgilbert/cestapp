import type { NextConfig } from 'next'

const isDevelopment = process.env.NODE_ENV === 'development'

function getInsforgeOrigins() {
  const configuredUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
  if (!configuredUrl) {
    throw new Error('NEXT_PUBLIC_INSFORGE_URL is required to build the security policy.')
  }

  const url = new URL(configuredUrl)
  const allowedProtocol = url.protocol === 'https:' || (isDevelopment && url.protocol === 'http:')
  if (!allowedProtocol || url.username || url.password) {
    throw new Error('NEXT_PUBLIC_INSFORGE_URL must be a trusted HTTPS origin.')
  }

  const websocketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return {
    http: url.origin,
    websocket: `${websocketProtocol}//${url.host}`,
  }
}

const insforgeOrigins = getInsforgeOrigins()
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${insforgeOrigins.http} https://lh3.googleusercontent.com https://avatars.githubusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${insforgeOrigins.http} ${insforgeOrigins.websocket}${isDevelopment ? ' ws:' : ''}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), publickey-credentials-get=(), usb=()',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  ...(!isDevelopment
    ? [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      }]
    : []),
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['saturno', 'saturno.taile4db48.ts.net'],
  headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
