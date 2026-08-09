import { createElement } from 'react'
import { ImageResponse } from 'next/og'

const supportedSizes = new Set([180, 192, 512])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const requestedSize = Number((await params).size)
  if (!supportedSizes.has(requestedSize)) {
    return new Response('Icon size not found', { status: 404 })
  }

  const fontSize = Math.round(requestedSize * 0.38)
  const inset = Math.round(requestedSize * 0.08)

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: inset,
          background: '#2d7a44',
        },
      },
      createElement(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '24%',
            background: 'linear-gradient(145deg, #fbbf24, #f3b03d)',
            color: '#3a2600',
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.08em',
            paddingRight: Math.round(requestedSize * 0.03),
          },
        },
        'C+',
      ),
    ),
    {
      width: requestedSize,
      height: requestedSize,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}
