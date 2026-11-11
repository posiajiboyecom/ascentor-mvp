import type { Metadata } from 'next';

// Sign-up is gated while the community is closed; not a search landing page.
export const metadata: Metadata = { title: 'Create your account', robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
