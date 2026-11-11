import type { Metadata } from 'next';

// Registration confirmation: personal, never indexed.
export const metadata: Metadata = { title: 'You are registered', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
