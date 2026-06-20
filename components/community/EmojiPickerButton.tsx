'use client';

// components/community/EmojiPickerButton.tsx
// Sits in the message composer where the prototype's '+' icon was.
// Clicking opens a small categorized emoji grid; picking one calls
// onSelect(emoji) so the parent composer can insert it into the draft.
// Pure UI — no message-sending logic lives here.

import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { EMOJI_CATEGORIES } from './emojiSet';

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPickerButton({ onSelect, className = '' }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label="Insert emoji"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <Smile className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
      </button>

      {open && (
        <div
          className="
            absolute bottom-full left-0 mb-2 z-50
            w-[260px] max-h-[280px] overflow-y-auto
            rounded-xl border-[0.5px] border-[var(--color-border-secondary)]
            bg-[var(--color-background-primary)]
            shadow-lg p-2
          "
        >
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-2 last:mb-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-secondary)] px-1.5 mb-1">
                {cat.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="flex items-center justify-center h-7 w-7 rounded-md text-base hover:bg-[var(--color-background-secondary)] transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
