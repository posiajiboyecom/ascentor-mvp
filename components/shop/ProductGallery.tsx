'use client';

import { useState } from 'react';

// Main picture plus a row of thumbnails. Used on the product pages (public shop and member store).
// The cover comes first, then the hover picture, then the gallery. Pictures and GIFs are treated the same.
export default function ProductGallery({ name, urls, fallback, children, className, height }: {
  name: string; urls: string[]; fallback: React.ReactNode; children?: React.ReactNode; className?: string; height?: number;
}) {
  const [i, setI] = useState(0);
  const current = urls[Math.min(i, urls.length - 1)];
  return (
    <div>
      <div className={className} style={height ? { height, position: 'relative', overflow: 'hidden', borderRadius: 10 } : undefined}>
        {current
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={current} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : fallback}
        {children}
      </div>
      {urls.length > 1 && (
        <div role="tablist" aria-label={`${name} pictures`} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {urls.map((u, n) => (
            <button
              key={u} type="button" role="tab" aria-selected={n === i} aria-label={`Show picture ${n + 1}`} onClick={() => setI(n)}
              style={{ width: 64, height: 64, padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#F1EFEA', border: n === i ? '2px solid #B6502A' : '1px solid #E8E6E1' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
