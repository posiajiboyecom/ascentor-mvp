'use client';

// "Make your I will be attending flyer": shown only after someone has registered (success overlay and confirmation page).
// The flyer page itself is not linked from the menu, footer or sitemap.
import { useEffect, useState } from 'react';
import { ImageDown } from 'lucide-react';

export const SUMMIT_NAME_KEY = 'summit-registrant-name';

export default function FlyerCta({ onClick, solid = false }: { onClick?: () => void; solid?: boolean }) {
  const [href, setHref] = useState('/elevation-summit/attend');
  useEffect(() => {
    try {
      const n = sessionStorage.getItem(SUMMIT_NAME_KEY);
      if (n) setHref(`/elevation-summit/attend?n=${encodeURIComponent(n)}`);
    } catch { /* no storage: the flyer page just starts blank */ }
  }, []);
  return (
    <a
      href={href}
      onClick={onClick}
      className={solid ? 'btn-gold' : undefined}
      style={solid
        ? { display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
        : { fontSize: '0.9375rem', padding: '0.75rem 1.75rem', background: 'transparent', border: '1.5px solid #E8E6E1', borderRadius: '0.625rem', color: '#0F0F0E', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
    >
      <ImageDown size={16} /> Make my &quot;I will be attending&quot; flyer
    </a>
  );
}
