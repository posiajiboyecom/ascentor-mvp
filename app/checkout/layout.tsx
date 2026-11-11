import type { Metadata } from 'next';

// Checkout is transactional and personal; keep it out of search.
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
