import type { Metadata, Viewport } from 'next';
import './globals.css';
import CommunityGateModal from '@/components/CommunityGateModal';

import RoutePreloader from '@/components/RoutePreloader';
import { ModalProvider } from '@/components/Modal';
import { NotificationProvider } from '@/components/Notifications';
import { MobileInit } from '@/components/MobileInit';
import AuthErrorHandler from '@/components/AuthErrorHandler';
import AuthRedirectError from '@/components/AuthRedirectError';
import StructuredData from '@/components/StructuredData';
import { headers } from 'next/headers';
import Script from 'next/script';

// ── Fonts ──────────────────────────────────────────────────────────
// Metropolis is loaded locally from public/fonts/metropolis/
// See globals.css for @font-face declarations

// ── Metadata ───────────────────────────────────────────────────────
export const metadata: Metadata = {
  // metadataBase makes all relative OG/twitter image + canonical URLs
  // resolve against the production domain (incl. the dynamic
  // app/opengraph-image.tsx). Without it Next falls back to localhost
  // or the Vercel deployment URL.
  metadataBase: new URL('https://ascentorbi.com'),
  alternates: { canonical: '/' },
  title: {
    default: 'Ascentor, Build a life that outlasts you.',
    template: '%s | Ascentor',
  },
  description:
    'Ascentor is the platform of The Elevation Summit, a global community of purposeful individuals building lives of meaning, leadership, and lasting impact.',
  keywords: [
    'purposeful living',
    'personal development',
    'The Elevation Summit',
    'leadership',
    'community',
    'impact',
    'nation building',
    'total person',
  ],
  authors: [{ name: 'Ajiboye Ayomiposi Samuel' }],
  creator: 'Ascentor',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ascentor',
    startupImage: '/icon/icon-512.png',
  },
  openGraph: {
    title: 'Ascentor, The Elevation Summit Platform',
    description:
      'Join a global community of purposeful individuals. The official platform of The Elevation Summit movement.',
    url: 'https://ascentorbi.com',
    siteName: 'Ascentor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascentor, Build a life that outlasts you.',
    description: 'The platform of The Elevation Summit movement.',
    creator: '@ascentorhq',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAFAF8',
};

// ── Root Layout ────────────────────────────────────────────────────
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the per-request nonce injected by proxy.ts middleware (M-06)
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';
  return (
    // suppressHydrationWarning is required here because the inline theme
    // script sets data-app-theme before React hydrates, causing a mismatch.
    // This is intentional and safe - it only suppresses the warning on <html>.
      <html
        lang="en"
        data-app-theme="light"
        suppressHydrationWarning
      >
      <head>
        <StructuredData />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon/icon-192.png" />

        {/* Plausible Analytics */}
        <Script
          defer
          nonce={nonce}
          data-domain="ascentorbi.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <RoutePreloader />
        <AuthErrorHandler />
        <AuthRedirectError />
        <ModalProvider>
          <NotificationProvider>
            <MobileInit />
            {children}
            <CommunityGateModal />
          </NotificationProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
