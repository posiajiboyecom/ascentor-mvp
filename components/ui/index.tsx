// components/ui/index.tsx
// ─────────────────────────────────────────────────────────────────────
// Ascentor UI primitives. Every in-app screen should compose these
// instead of hand-rolling cards/buttons/labels with inline styles.
// One radius scale, one border, one voice — this file is where the
// product's consistency is enforced.
//
// All primitives are server-component-safe (no hooks, no state).
// ─────────────────────────────────────────────────────────────────────

import type { ReactNode, ButtonHTMLAttributes } from 'react';

// ── Card ─────────────────────────────────────────────────────────────
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`
        rounded-[var(--app-radius-md)] border border-[var(--border)]
        bg-[var(--bg-card)] ${padded ? 'p-4 lg:p-6' : ''} ${className}
      `}
    >
      {children}
    </div>
  );
}

// ── SectionLabel — small-caps eyebrow above a group ─────────────────
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`asc-eyebrow mb-2 ${className}`}>{children}</p>;
}

// ── Buttons ──────────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function GoldButton({ children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-[var(--app-radius-sm)] px-4 py-2.5
        bg-[var(--app-accent)] text-[#0F0F0E]
        text-sm font-semibold
        transition-colors duration-150 ease-out
        hover:bg-[var(--app-accent-strong)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-[var(--app-radius-sm)] px-4 py-2.5
        border border-[var(--border)] bg-transparent
        text-sm font-medium text-[var(--text-muted)]
        transition-colors duration-150 ease-out
        hover:border-[var(--app-border-gold)] hover:text-[var(--text)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// ── EmptyState — direction, in the brand voice ───────────────────────
// Serif invitation line + one gold action. Never a gray illustration.
export function EmptyState({
  line,
  action,
  className = '',
}: {
  line: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`py-12 px-6 text-center ${className}`}>
      <p className="font-serif text-lg lg:text-xl text-[var(--text-muted)] leading-relaxed max-w-md mx-auto">
        {line}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// ── Skeleton — shaped placeholder, never a spinner ───────────────────
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden="true" className={`asc-skeleton ${className}`} style={style} />;
}

// ── LedgerLine — the signature, as a component ───────────────────────
export function LedgerLine({
  animated = true,
  className = '',
}: {
  animated?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${animated ? 'ledger-line' : 'ledger-line-static'} ${className}`}
    />
  );
}
