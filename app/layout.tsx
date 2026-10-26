import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/styles/rust.css';
import CommunityGateModal from '@/components/CommunityGateModal';

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
// Site-wide defaults only. Do NOT set alternates, openGraph, twitter or description here: Next inherits a layout's
// canonical into every page that does not set its own, and a page's openGraph replaces the layout's entirely.
// Every page sets its own through pageMeta() in lib/seo.ts.
export const metadata: Metadata = {
  // metadataBase makes all relative OG/twitter image + canonical URLs resolve against the production domain
  // (incl. the dynamic app/opengraph-image.tsx). Without it Next falls back to localhost or the Vercel URL.
  metadataBase: new URL('https://joinascentor.com'),
  applicationName: 'Ascentor',
  // Pages that set a plain title get the suffix; the homepage uses title.absolute.
  title: {
    default: 'Ascentor | Mentorship & Leadership for Young Africans',
    template: '%s | Ascentor',
  },
  authors: [{ name: 'Posi Ajiboye' }],
  creator: 'Ascentor',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ascentor',
    startupImage: '/icon/icon-512.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
          data-domain="joinascentor.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>
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
