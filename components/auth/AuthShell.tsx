'use client';

// components/auth/AuthShell.tsx
// The signed-out layout from the design prototype: an art panel (logo, rust bar, title, subtitle)
// beside the form column. Light by default, dark when the system is dark (styles/auth.css).

import { forwardRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import '@/styles/auth.css';
import AuthPageGuard from './AuthPageGuard';

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="ax">
      <AuthPageGuard />
      <div className="ax-art">
        <Link href="/" aria-label="Ascentor home" style={{ display: 'inline-block' }}>
          <img className="ax-logo light" src="/ascentor-color-for-light-pages.svg" alt="Ascentor" />
          <img className="ax-logo dark" src="/ascentor-color-for-dark-pages.svg" alt="" aria-hidden="true" />
        </Link>
        <div className="ax-artcopy">
          <span className="ax-rustbar" />
          <p className="ax-hero">{title}</p>
          <p className="ax-artsub">{sub}</p>
        </div>
      </div>
      <main className="ax-body">{children}</main>
    </div>
  );
}

/** Password field with the show/hide toggle. Works with react-hook-form's register() spread. */
export const AuthPassword = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function AuthPassword(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="ax-pw">
      <input {...props} ref={ref} className="ax-in" type={show ? 'text' : 'password'} />
      <button type="button" className="ax-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
});
