'use client';

// Ledger-styled select, built on @radix-ui/react-select for real keyboard
// navigation, typeahead and screen-reader semantics -- a plain <select> or a
// row of manually-styled buttons gives you neither. Scoped to [data-ledger]
// tokens so it drops into any admin page already wrapped in that theme.
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface LedgerSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Optional fixed width; defaults to filling its container. */
  width?: number | string;
  ariaLabel?: string;
}

export default function Select({ value, onValueChange, options, placeholder, width, ariaLabel }: LedgerSelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: width ?? 'auto', minWidth: 160,
          padding: '8px 12px', borderRadius: 'var(--ledger-radius-md)',
          border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-card)',
          color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-ui)', fontSize: 13,
          cursor: 'pointer', outline: 'none',
        }}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={14} color="var(--ledger-ink-faint)" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          style={{
            zIndex: 9998, overflow: 'hidden',
            background: 'var(--ledger-bg-card)', border: '1px solid var(--ledger-line-strong)',
            borderRadius: 'var(--ledger-radius-md)', boxShadow: 'var(--ledger-shadow)',
            minWidth: 'var(--radix-select-trigger-width)',
          }}
        >
          <RadixSelect.Viewport style={{ padding: 4 }}>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)',
                  fontFamily: 'var(--ledger-font-ui)', fontSize: 13, color: 'var(--ledger-ink)',
                  cursor: 'pointer', outline: 'none', userSelect: 'none',
                }}
                className="ledger-select-item"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <Check size={14} color="var(--ledger-gold-deep)" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
