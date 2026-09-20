'use client';

// Right-hand slide-over panel for admin detail views.
//
// Why it renders through a portal:
//   * Page wrappers use `.animate-fade-up`, whose finished animation leaves a
//     `transform` on the element. A transformed ancestor becomes the containing
//     block for `position: fixed` children, so a panel rendered inside the page
//     is positioned and clipped relative to the page instead of the screen (it
//     rendered blank). Mounting on <body> avoids that entirely.
//   * The admin theme tokens and .ledger-* classes are scoped to [data-ledger],
//     so the portal root carries that attribute itself.
//
// Layer order (z-index) across the admin shell:
//   header 40 · drawer scrim 55 · sidebar 60 · Sage orb 70 · avatar menu 80
//   OFF-CANVAS backdrop 100 / panel 101 · search palette 120 · confirm dialogs 9999
// so the panel covers the header, sidebar and the floating orb, while the
// search palette and confirmation dialogs still appear above it.

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface OffCanvasProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sticky action bar pinned to the bottom of the panel. */
  footer?: ReactNode;
  children: ReactNode;
}

export default function OffCanvas({ open, onClose, title, subtitle, footer, children }: OffCanvasProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no page scroll behind the panel
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div data-ledger data-ledger-theme="light" style={{ position: 'relative', zIndex: 100 }}>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,15,14,0.45)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .2s ease',
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Details"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 101,
          width: 'min(440px, 100vw)', display: 'flex', flexDirection: 'column',
          background: '#FFFFFF', color: 'var(--ledger-ink)', borderLeft: '1px solid var(--ledger-line-strong)',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.22)',
          transform: open ? 'translateX(0)' : 'translateX(105%)',
          visibility: open ? 'visible' : 'hidden',
          transition: 'transform .26s cubic-bezier(.22,1,.36,1), visibility 0s linear ' + (open ? '0s' : '.26s'),
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '18px 20px 14px', borderBottom: '1px solid var(--ledger-line)', flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="ledger-h1" style={{ fontSize: 18, margin: 0, wordBreak: 'break-word' }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--ledger-ink-soft)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ledger-btn ledger-btn-ghost" style={{ padding: 6, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px' }}>{children}</div>

        {footer && (
          <div style={{
            flexShrink: 0, padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--ledger-line)', background: '#FFFFFF', display: 'grid', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
