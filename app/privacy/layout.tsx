import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'Privacy Policy',
  description: 'How Ascentor collects, uses, stores and protects your personal data, the choices you have, and how to contact us about your privacy.',
  path: '/privacy',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
