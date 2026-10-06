'use client';

// components/auth/AuthModal.tsx
// One dialog for every sign-in and sign-up problem that needs a clear explanation and a next step
// (account already exists, use Google instead, email not confirmed, and so on).

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, Info } from 'lucide-react';

export interface AuthModalAction {
  label: string;
  /** Navigates when set; otherwise onClick runs. */
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  /** Optional leading icon (for example a provider logo). */
  icon?: React.ReactNode;
}

interface AuthModalProps {
  open: boolean;
  title: string;
  message: string;
  tone?: 'error' | 'info';
  actions?: AuthModalAction[];
  onClose: () => void;
}

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '0.7rem 1.1rem', borderRadius: 10, fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', textDecoration: 'none',
};

export default function AuthModal({ open, title, message, tone = 'error', actions = [], onClose }: AuthModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const Icon = tone === 'error' ? AlertCircle : Info;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,15,14,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-message"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: 16, padding: '1.75rem', maxWidth: 460, width: '100%', boxShadow: '0 24px 64px rgba(15,15,14,0.22)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon size={22} color={tone === 'error' ? '#DC2626' : '#8A6A2B'} aria-hidden="true" />
          <h2 id="auth-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E' }}>{title}</h2>
        </div>
        <p id="auth-modal-message" style={{ margin: '0 0 1.5rem', fontSize: '0.9375rem', lineHeight: 1.6, color: '#374151' }}>{message}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((a) => {
            const style: React.CSSProperties = a.variant === 'secondary'
              ? { ...BTN, background: '#FFFFFF', color: '#0F0F0E', border: '1.5px solid #E8E6E1' }
              : { ...BTN, background: '#0F0F0E', color: '#FAFAF8', border: 'none' };
            return a.href ? (
              <Link key={a.label} href={a.href} onClick={onClose} style={style}>{a.icon}{a.label}</Link>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} style={style}>{a.icon}{a.label}</button>
            );
          })}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{ ...BTN, background: 'transparent', color: '#6B7280', border: 'none', fontWeight: 500 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
