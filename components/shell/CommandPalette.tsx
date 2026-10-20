'use client';

// Global search / command palette (Ctrl/Cmd + K).
// Instant results for navigation pages (from the sidebar config) plus debounced
// server results from `endpoint` (users, courses, sessions, … depending on the
// dashboard). Fully keyboard driven.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CornerDownLeft, Search } from 'lucide-react';
import type { SearchResultGroup, ShellNavGroup } from './types';

interface Row {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  href: string;
  icon?: React.ReactNode;
}

export default function CommandPalette({
  open,
  onClose,
  groups,
  endpoint,
  placeholder,
  searchPageHref,
}: {
  open: boolean;
  onClose: () => void;
  groups: ShellNavGroup[];
  endpoint: string;
  placeholder: string;
  searchPageHref?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  // Reset + focus each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setRemote([]);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced server search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setRemote([]); setLoading(false); return; }

    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        setRemote(Array.isArray(body?.groups) ? body.groups : []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setRemote([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => { clearTimeout(t); controller.abort(); };
  }, [query, open, endpoint]);

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages: Row[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        if (q && !item.label.toLowerCase().includes(q) && !(g.label ?? '').toLowerCase().includes(q)) continue;
        pages.push({
          key: `page:${item.href}`,
          group: 'Pages',
          title: item.label,
          subtitle: g.label,
          href: item.href,
          icon: item.icon,
        });
      }
    }
    const found: Row[] = remote.flatMap(g =>
      g.items.map((it, i) => ({
        key: `r:${g.label}:${it.href}:${i}`,
        group: g.label,
        title: it.title,
        subtitle: it.subtitle,
        href: it.href,
        icon: <ArrowUpRight />,
      })),
    );
    // Live results first once the user is searching; pages first otherwise.
    const base = q ? [...found, ...pages.slice(0, 8)] : pages.slice(0, 10);
    if (searchPageHref) {
      const raw = query.trim();
      base.push(raw.length >= 2
        ? { key: 'see-all', group: 'Search', title: `See all results for “${raw}”`, href: `${searchPageHref}?q=${encodeURIComponent(raw)}`, icon: <Search /> }
        : { key: 'see-all', group: 'Search', title: 'Open search', subtitle: 'Lessons, rooms, people, posts and sessions', href: searchPageHref, icon: <Search /> });
    }
    return base;
  }, [query, groups, remote, searchPageHref]);

  useEffect(() => { setActive(0); }, [rows.length, query]);

  // Keep the highlighted row visible.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let lastGroup = '';

  return (
    <div className="sh-palette-backdrop" onMouseDown={onClose}>
      <div
        className="sh-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="sh-palette-input">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="sh-kbd">Searching…</span>}
          <button type="button" className="sh-kbd" onClick={onClose} aria-label="Close search">Esc</button>
        </div>

        <div className="sh-palette-list" ref={listRef} role="listbox">
          {rows.length === 0 ? (
            <div className="sh-palette-empty">
              {query.trim().length < 2 ? 'Type to search…' : loading ? 'Searching…' : `No results for “${query.trim()}”`}
            </div>
          ) : (
            rows.map((row, i) => {
              const header = row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              return (
                <div key={row.key}>
                  {header && <div className="sh-palette-group">{header}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    className="sh-palette-item"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(row)}
                  >
                    <span className="sh-pi-icon" aria-hidden="true">{row.icon}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <div className="sh-pi-title">{row.title}</div>
                      {row.subtitle && <div className="sh-pi-sub">{row.subtitle}</div>}
                    </span>
                    {i === active && <CornerDownLeft size={14} aria-hidden="true" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="sh-palette-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
