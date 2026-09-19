import type { ReactNode } from 'react';

export interface ShellNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

export interface ShellNavGroup {
  /** Omit for an unlabelled group (e.g. the top-level app nav). */
  label?: string;
  items: ShellNavItem[];
}

export interface ShellUser {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  /** Shown as a small tag in the sidebar and avatar menu (e.g. "admin"). */
  role?: string | null;
}

export interface ShellMenuLink {
  href: string;
  label: string;
  icon: ReactNode;
}

/** Shape returned by /api/search and /api/admin/search. */
export interface SearchResultGroup {
  label: string;
  items: { title: string; subtitle?: string; href: string }[];
}

export const isActivePath = (pathname: string | null, href: string): boolean =>
  !!pathname && (pathname === href || pathname.startsWith(href + '/'));

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
