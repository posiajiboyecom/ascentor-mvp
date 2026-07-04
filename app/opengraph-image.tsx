// app/opengraph-image.tsx
// Default Open Graph image for every page that doesn't define its own.
// Rendered at the edge via next/og — no static asset to maintain.
// WhatsApp, X, LinkedIn, iMessage all pick this up automatically once
// metadataBase is set in the root layout.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Ascentor — Build a life that outlasts you.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0C0B08 0%, #1A1A2E 100%)',
          color: '#FFFBF5',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: '#E8A020',
              display: 'flex',
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2, display: 'flex' }}>
            ASCENTOR
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, display: 'flex' }}>
            Build a life that outlasts you.
          </div>
          <div style={{ fontSize: 30, color: '#E8A020', display: 'flex' }}>
            Purpose · Leadership · Community · Legacy
          </div>
        </div>

        <div style={{ fontSize: 26, color: '#9CA3AF', display: 'flex' }}>
          ascentorbi.com — home of The Elevation Summit
        </div>
      </div>
    ),
    { ...size },
  );
}
