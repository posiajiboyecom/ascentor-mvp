'use client';

import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { Check, AlertTriangle, XCircle, Trash2 } from 'lucide-react';

// ============================================================
// In-App Modal System (light theme)
// Replaces browser alert(), prompt() and confirm().
//
//   const { alert, confirm, prompt } = useModal();
//   if (!(await confirm('Delete this?', 'Delete', 'error', { danger: true, confirmLabel: 'Delete' }))) return;
//
// Or, anywhere (event handlers, plain functions) without a hook:
//
//   import { confirmAction } from '@/components/Modal';
//   if (!(await confirmAction('Delete "Course A"? This cannot be undone.'))) return;
//
// confirmAction() infers a sensible title, button label and red "danger"
// styling from the wording (delete / remove / ban / discard / ...), so every
// sensitive action gets a consistent confirmation with one line of code.
// ============================================================

interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

interface ModalConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button red and focuses Cancel first. */
  danger?: boolean;
}

interface ModalConfig {
  title?: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  variant?: 'success' | 'warning' | 'error';
  placeholder?: string;
  defaultValue?: string;
  inputType?: string;
  danger?: boolean;
  buttons: ModalButton[];
  onClose: () => void;
}

// success -> --color-success, warning -> --accent (gold), error -> --color-error
const VARIANT_COLORS = {
  success: 'var(--color-success, #16A34A)',
  warning: 'var(--accent, #C8A96E)',
  error: 'var(--color-error, #DC2626)',
};

function VariantIcon({ variant, danger }: { variant?: 'success' | 'warning' | 'error'; danger?: boolean }) {
  const effective = variant ?? (danger ? 'error' : undefined);
  if (!effective) return null;
  const color = VARIANT_COLORS[effective];
  const Icon = danger ? Trash2 : effective === 'success' ? Check : effective === 'warning' ? AlertTriangle : XCircle;
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <Icon size={20} color={color} />
    </div>
  );
}

// --- Modal Overlay Component ---
function ModalOverlay({ config }: { config: ModalConfig }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || '');
  // busy guards every button against double-clicks (e.g. confirm-to-pay)
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus: prompt -> input; destructive confirm -> Cancel (safe default); otherwise the primary action.
    if (config.type === 'prompt') inputRef.current?.focus();
    else if (config.danger) cancelRef.current?.focus();
    else primaryRef.current?.focus();

    // Lock page scroll while the dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { config.onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      // Keep Tab focus inside the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [config]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) config.onClose();
  };

  const buttonStyle = (variant: string = 'secondary'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
      cursor: 'pointer', border: 'none', transition: 'opacity 0.15s, transform 0.05s', minWidth: 88,
      fontFamily: 'inherit',
    };
    switch (variant) {
      case 'primary':
        return { ...base, background: 'var(--accent, #C8A96E)', color: '#0F0F0E' };
      case 'danger':
        return { ...base, background: 'var(--color-error, #DC2626)', color: '#fff' };
      default:
        return { ...base, background: '#fff', color: 'var(--text, #0F0F0E)', border: '1px solid var(--border, #E8E6E1)' };
    }
  };

  const titleId = 'modal-title';
  const descId = 'modal-desc';

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15, 15, 14, 0.45)', backdropFilter: 'blur(3px)',
        animation: 'modalFadeIn 0.15s ease-out', padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role={config.type === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={config.title ? titleId : undefined}
        aria-describedby={descId}
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border, #E8E6E1)',
          borderTop: config.variant ? `4px solid ${VARIANT_COLORS[config.variant]}` : undefined,
          borderRadius: 16, padding: 24, maxWidth: 440, width: '100%',
          boxShadow: '0 20px 60px rgba(15,15,14,0.22)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <VariantIcon variant={config.variant} danger={config.danger} />
          <div style={{ minWidth: 0 }}>
            {config.title && (
              <h3 id={titleId} style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text, #0F0F0E)' }}>
                {config.title}
              </h3>
            )}
            <p id={descId} style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #374151)', lineHeight: 1.55 }}>
              {config.message}
            </p>
          </div>
        </div>

        {config.type === 'prompt' && (
          <input
            ref={inputRef}
            type={config.inputType || 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={config.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const okBtn = config.buttons.find(b => b.variant === 'primary');
                if (okBtn) { (window as any).__modalInputValue = inputValue; okBtn.onClick(); }
              }
            }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--border, #E8E6E1)', background: 'var(--bg-input, #F4F3EF)',
              color: 'var(--text, #0F0F0E)', fontSize: 14, marginBottom: 20, outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {config.buttons.map((btn, i) => {
            const isCancel = btn.variant === 'secondary';
            return (
              <button
                key={i}
                ref={isCancel ? cancelRef : primaryRef}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setBusy(true);
                  if (config.type === 'prompt' && btn.variant === 'primary') {
                    (window as any).__modalInputValue = inputValue;
                  }
                  btn.onClick();
                }}
                style={{ ...buttonStyle(btn.variant), opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { [role="dialog"], [role="alertdialog"] { animation: none !important; } }
      `}</style>
    </div>
  );
}

// --- Modal Context & Provider ---
type ConfirmFn = (message: string, title?: string, variant?: 'success' | 'warning' | 'error', options?: ModalConfirmOptions) => Promise<boolean>;

interface ModalContextType {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: ConfirmFn;
  prompt: (message: string, options?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | null>(null);

// Registered by <ModalProvider>; lets confirmAction() work outside React hooks.
let confirmImpl: ConfirmFn | null = null;

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const closeModal = useCallback(() => setModal(null), []);

  const alert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        type: 'alert',
        title: title || 'Notice',
        message,
        buttons: [
          { label: 'OK', variant: 'primary', onClick: () => { closeModal(); resolve(); } },
        ],
        onClose: () => { closeModal(); resolve(); },
      });
    });
  }, [closeModal]);

  const confirm = useCallback<ConfirmFn>((message, title, variant, options) => {
    const danger = options?.danger ?? variant === 'error';
    return new Promise((resolve) => {
      setModal({
        type: 'confirm',
        title: title || 'Confirm',
        message,
        variant,
        danger,
        buttons: [
          { label: options?.cancelLabel || 'Cancel', variant: 'secondary', onClick: () => { closeModal(); resolve(false); } },
          { label: options?.confirmLabel || 'OK', variant: danger ? 'danger' : 'primary', onClick: () => { closeModal(); resolve(true); } },
        ],
        onClose: () => { closeModal(); resolve(false); },
      });
    });
  }, [closeModal]);

  const prompt = useCallback((message: string, options?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }): Promise<string | null> => {
    return new Promise((resolve) => {
      setModal({
        type: 'prompt',
        title: options?.title || 'Input',
        message,
        placeholder: options?.placeholder,
        defaultValue: options?.defaultValue,
        inputType: options?.inputType,
        buttons: [
          { label: 'Cancel', variant: 'secondary', onClick: () => { closeModal(); resolve(null); } },
          {
            label: 'OK',
            variant: 'primary',
            onClick: () => {
              const value = (window as any).__modalInputValue || '';
              delete (window as any).__modalInputValue;
              closeModal();
              resolve(value);
            },
          },
        ],
        onClose: () => { closeModal(); resolve(null); },
      });
    });
  }, [closeModal]);

  useEffect(() => {
    confirmImpl = confirm;
    return () => { if (confirmImpl === confirm) confirmImpl = null; };
  }, [confirm]);

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {modal && <ModalOverlay config={modal} />}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

// ── confirmAction: hook-free confirmation ─────────────────────────────────

export interface ConfirmActionOptions extends ModalConfirmOptions {
  title?: string;
  variant?: 'success' | 'warning' | 'error';
}

const DESTRUCTIVE = /\b(delete|remove|ban|discard|permanently|unpublish|revoke|deactivate|cancel (this )?(event|subscription))\b/i;

/** Picks a title / button label from the wording so callers rarely need options. */
function inferConfirm(message: string): { title: string; label: string; danger: boolean } {
  const m = message.toLowerCase();
  const pick = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  const verbs: [RegExp, string][] = [
    [/\bdelete\b/, 'delete'], [/\bremove\b/, 'remove'], [/\bban\b/, 'ban'], [/\bdiscard\b/, 'discard'],
    [/\bunpublish\b/, 'unpublish'], [/\bleave\b/, 'leave'], [/\bsend\b/, 'send'], [/\bchange\b/, 'change'],
    [/\bcancel\b/, 'cancel'], [/\bcomplete\b/, 'complete'], [/\bmark\b/, 'mark'], [/\bsign out\b|\blog ?out\b/, 'sign out'],
  ];
  const found = verbs.find(([re]) => re.test(m));
  const verb = found ? found[1] : '';
  const danger = DESTRUCTIVE.test(message);
  if (!verb) return { title: 'Please confirm', label: 'Confirm', danger };
  const label = verb === 'cancel' ? 'Yes, cancel' : pick(verb);
  return { title: `${pick(verb)}?`, label, danger };
}

/**
 * Promise-based confirmation dialog. Resolves true only if the user confirms.
 * Falls back to window.confirm if no <ModalProvider> is mounted.
 */
export function confirmAction(message: string, options: ConfirmActionOptions = {}): Promise<boolean> {
  const inferred = inferConfirm(message);
  const danger = options.danger ?? inferred.danger;
  if (!confirmImpl) {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  }
  return confirmImpl(message, options.title ?? inferred.title, options.variant, {
    confirmLabel: options.confirmLabel ?? inferred.label,
    cancelLabel: options.cancelLabel,
    danger,
  });
}

export default ModalOverlay;
