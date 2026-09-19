'use client';

// Dashboard-scoped search.
//
// The shell header owns ONE search input. A page opts in by calling
//
//     const query = usePageSearch('Search courses…');
//
// and filtering its own list with `query`. While such a page is mounted the
// header input filters that page; otherwise the header falls back to the global
// command palette. The query resets automatically when the page unmounts.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface PageSearchCtx {
  scope: string | null;
  query: string;
  setQuery: (q: string) => void;
  register: (placeholder: string) => void;
  unregister: () => void;
}

const Ctx = createContext<PageSearchCtx | null>(null);

export function PageSearchProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const register   = useCallback((placeholder: string) => setScope(placeholder), []);
  const unregister = useCallback(() => { setScope(null); setQuery(''); }, []);

  const value = useMemo(
    () => ({ scope, query, setQuery, register, unregister }),
    [scope, query, register, unregister],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageSearchContext(): PageSearchCtx | null {
  return useContext(Ctx);
}

/** Registers the current page as searchable and returns the live query. */
export function usePageSearch(placeholder: string): string {
  const ctx = useContext(Ctx);
  const register   = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    register?.(placeholder);
    return () => unregister?.();
  }, [register, unregister, placeholder]);

  return ctx?.query ?? '';
}
