import type { Metadata } from 'next';

// Staff sign-in is intentionally not indexed or linked from public pages.
export const metadata: Metadata = {
  title: 'Staff sign in',
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
