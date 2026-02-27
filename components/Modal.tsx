'use client';

import { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';

// ============================================================
// FEATURE #8: In-App Modal System
// Replaces ALL browser alert(), prompt(), confirm() dialogs
// Usage: const { alert, confirm, prompt } = useModal();
// ============================================================

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

// --- Modal Overlay Component ---
function ModalOverlay({ config }: { config: ModalConfig }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config.type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
    }
    // Trap focus inside modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') config.onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) config.onClose();
  };

  const buttonStyle = (variant: string = 'secondary') => {
    const base: React.CSSProperties = {
      padding: '10px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s ease',
      minWidth: '80px',
    };
    switch (variant) {
      case 'primary':
        return { ...base, background: 'var(--accent, #E8A020)', color: '#000' };
      case 'danger':
        return { ...base, background: 'var(--error, #EF4444)', color: '#fff' };
      default:
        return { ...base, background: 'var(--bg-input, #1A1D2E)', color: 'var(--text, #F1F0EB)', border: '1px solid var(--border, #2A2D3A)' };
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'modalFadeIn 0.15s ease-out',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #12151F)',
          border: '1px solid var(--border, #2A2D3A)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
      >
        {config.title && (
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text, #F1F0EB)',
          }}>
            {config.title}
          </h3>
        )}

        <p style={{
          margin: '0 0 20px 0',
          fontSize: '14px',
          color: 'var(--text-muted, #C5C4BF)',
          lineHeight: 1.5,
        }}>
          {config.message}
        </p>

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
                if (okBtn) okBtn.onClick();
              }
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, #2A2D3A)',
              background: 'var(--bg-input, #1A1D2E)',
              color: 'var(--text, #F1F0EB)',
              fontSize: '14px',
              marginBottom: '20px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {config.buttons.map((btn, i) => (
            <button
              key={i}
              onClick={() => {
                if (config.type === 'prompt' && btn.variant === 'primary') {
                  // Pass input value via a data attribute on the button click
                  (window as any).__modalInputValue = inputValue;
                }
                btn.onClick();
              }}
              style={buttonStyle(btn.variant)}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = '1';
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- Modal Context & Provider ---
interface ModalContextType {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, options?: { title?: string; placeholder?: string; defaultValue?: string; inputType?: string }) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | null>(null);

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

  const confirm = useCallback((message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        type: 'confirm',
        title: title || 'Confirm',
        message,
        buttons: [
          { label: 'Cancel', variant: 'secondary', onClick: () => { closeModal(); resolve(false); } },
          { label: 'OK', variant: 'primary', onClick: () => { closeModal(); resolve(true); } },
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

export default ModalOverlay;
