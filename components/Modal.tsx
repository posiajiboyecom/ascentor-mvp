'use client';

import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';

interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

interface ModalConfig {
  title?: string;
  message: string;
  type: 'alert' | 'confirm' | 'prompt';
  placeholder?: string;
  defaultValue?: string;
  inputType?: string;
  buttons: ModalButton[];
  onClose: () => void;
}

function ModalOverlay({ config }: { config: ModalConfig }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config.type === 'prompt' && inputRef.current) inputRef.current.focus();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') config.onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) config.onClose();
  };

  const btnStyle = (variant: string = 'secondary'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '9px 22px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
      cursor: 'pointer', border: 'none', transition: 'all 0.18s',
      minWidth: 80, fontFamily: 'Inter, sans-serif',
    };
    if (variant === 'primary')   return { ...base, background: 'var(--accent)', color: '#fff' };
    if (variant === 'danger')    return { ...base, background: 'var(--error)', color: '#fff' };
    return { ...base, background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };
  };

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      animation: 'mFadeIn 0.15s ease-out', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14, padding: '28px 28px 24px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(102,98,255,0.08)',
        animation: 'mSlideIn 0.2s ease-out',
      }}>
        {/* Icon stripe */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--accent)', marginBottom: 16, opacity: 0.7 }} />

        {config.title && (
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {config.title}
          </h3>
        )}
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}>
          {config.message}
        </p>

        {config.type === 'prompt' && (
          <input ref={inputRef} type={config.inputType || 'text'} value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={config.placeholder}
            onKeyDown={e => { if (e.key === 'Enter') { const ok = config.buttons.find(b => b.variant === 'primary'); if (ok) ok.onClick(); } }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, marginBottom: 20,
              border: '1px solid var(--border)', background: 'var(--bg-input)',
              color: 'var(--text)', fontSize: 14, outline: 'none',
              fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              transition: 'border-color 0.18s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(102,98,255,0.12)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
          />
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {config.buttons.map((btn, i) => (
            <button key={i} style={btnStyle(btn.variant)}
              onClick={() => {
                if (config.type === 'prompt' && btn.variant === 'primary') (window as any).__modalInputValue = inputValue;
                btn.onClick();
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.85'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes mFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mSlideIn { from { opacity: 0; transform: scale(0.96) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}

interface ModalContextType {
  alert:   (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt:  (message: string, options?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const closeModal = useCallback(() => setModal(null), []);

  const alert = useCallback((message: string, title?: string): Promise<void> =>
    new Promise(resolve => setModal({
      type: 'alert', title: title || 'Notice', message,
      buttons: [{ label: 'OK', variant: 'primary', onClick: () => { closeModal(); resolve(); } }],
      onClose: () => { closeModal(); resolve(); },
    })), [closeModal]);

  const confirm = useCallback((message: string, title?: string): Promise<boolean> =>
    new Promise(resolve => setModal({
      type: 'confirm', title: title || 'Confirm', message,
      buttons: [
        { label: 'Cancel', variant: 'secondary', onClick: () => { closeModal(); resolve(false); } },
        { label: 'Confirm', variant: 'primary',   onClick: () => { closeModal(); resolve(true);  } },
      ],
      onClose: () => { closeModal(); resolve(false); },
    })), [closeModal]);

  const prompt = useCallback((message: string, options?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }): Promise<string | null> =>
    new Promise(resolve => setModal({
      type: 'prompt', title: options?.title || 'Input', message,
      placeholder: options?.placeholder, defaultValue: options?.defaultValue, inputType: options?.inputType,
      buttons: [
        { label: 'Cancel', variant: 'secondary', onClick: () => { closeModal(); resolve(null); } },
        { label: 'OK', variant: 'primary', onClick: () => { const v = (window as any).__modalInputValue || ''; delete (window as any).__modalInputValue; closeModal(); resolve(v); } },
      ],
      onClose: () => { closeModal(); resolve(null); },
    })), [closeModal]);

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {modal && <ModalOverlay config={modal} />}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}

export default ModalOverlay;
