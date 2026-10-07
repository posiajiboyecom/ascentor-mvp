// components/rx/ui.tsx
// Server-safe building blocks shared by the reimagined screens. Styling lives in styles/rx.css.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, TriangleAlert, Check } from 'lucide-react';
import { avatarTone, initials } from '@/lib/rx/dates';

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rx rx-page rx-rise ${className}`}>{children}</div>;
}

export function Title({ children, tag }: { children: ReactNode; tag?: ReactNode }) {
  return (
    <>
      <div className="rx-between" style={{ alignItems: 'flex-end' }}>
        <h1 className="rx-title">{children}</h1>
        {tag}
      </div>
      <span className="rx-rule" />
    </>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rx-link muted">
      <ArrowLeft aria-hidden style={{ transform: 'none' }} />
      {children}
    </Link>
  );
}

export function GoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rx-link">
      {children}
      <ArrowRight aria-hidden />
    </Link>
  );
}

export function Tag({ children, gold }: { children: ReactNode; gold?: boolean }) {
  return <span className={`rx-tag${gold ? ' gold' : ''}`}>{children}</span>;
}

export function Avatar({ name, url, size, seed }: { name?: string | null; url?: string | null; size?: 'sm' | 'md' | 'lg'; seed?: string | null }) {
  const cls = `rx-avatar ${size ?? ''} ${avatarTone(seed ?? name)}`;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cls} />;
  }
  return <span className={cls} aria-hidden>{initials(name)}</span>;
}

export function SageLine({ children, label = 'Sage · AI coach' }: { children: ReactNode; label?: string }) {
  return (
    <p className="rx-sageline">
      <Sparkles aria-hidden />
      <span style={{ minWidth: 0 }}>
        <span className="sgl">{label}</span>
        <span className="tx">{children}</span>
      </span>
    </p>
  );
}

export function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="rx-bar" role="img" aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Banner({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`rx-banner${error ? ' err' : ''}`} role={error ? 'alert' : 'note'}>
      <TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rx-card rx-empty">
      <span className="rx-dimdot" aria-hidden><Sparkles /></span>
      <p className="rx-p">{children}</p>
      {action}
    </div>
  );
}

export function Tick({ className = '' }: { className?: string }) {
  return <Check aria-hidden className={className} style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />;
}

export function Aside({ children }: { children: ReactNode }) {
  return <aside className="rx-aside">{children}</aside>;
}

export function Skel({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return <span className="rx-skel" style={{ width: w, height: h }} aria-hidden />;
}
