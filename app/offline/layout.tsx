import type { Metadata } from 'next';

// Shown by the service worker when the device is offline; never a search result.
export const metadata: Metadata = { title: 'You are offline', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
