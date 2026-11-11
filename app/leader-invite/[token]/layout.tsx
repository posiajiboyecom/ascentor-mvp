import type { Metadata } from 'next';

// Personal invite links must never be indexed.
export const metadata: Metadata = { title: 'Your invitation', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
