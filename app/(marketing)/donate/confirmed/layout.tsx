import type { Metadata } from 'next';

// Post-payment confirmation: personal, never indexed.
export const metadata: Metadata = { title: 'Thank you', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
