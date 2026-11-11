import type { Metadata } from 'next';

// Sign-in form: useful to members, not a search landing page.
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
