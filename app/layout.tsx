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
import SplashGate from '@/components/SplashGate';
import { SPLASH_COVER_ID, splashPrePaintScript } from '@/lib/splash';

// ── Fonts ──────────────────────────────────────────────────────────
// Metropolis is loaded locally from public/fonts/metropolis/
// See globals.css for @font-face declarations

// ── Metadata ───────────────────────────────────────────────────────
export const metadata: Metadata = {
  // metadataBase makes all relative OG/twitter image + canonical URLs
  // resolve against the production domain (incl. the dynamic
  // app/opengraph-image.tsx). Without it Next falls back to localhost
  // or the Vercel deployment URL.
  metadataBase: new URL('https://joinascentor.com'),
  // No site-wide canonical here: a canonical set in the root layout is inherited by every page that
  // doesn't override it, which tells Google every page is a duplicate of the home page. Each public
  // page sets its own (generatePageMetadata in lib/seo.ts); the home page sets '/' in app/page.tsx.
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
    url: 'https://joinascentor.com',
    siteName: 'Ascentor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascentor, Build a life that outlasts you.',
    description: 'The platform of The Elevation Summit movement.',
    creator: '@ascentorhq',
  },
  // Google Search Console: set GOOGLE_SITE_VERIFICATION to the token from the "HTML tag" method.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

// Pinch-zoom stays enabled on the public site (WCAG 1.4.4; Lighthouse flags user-scalable=no).
// The signed-in app shell sets its own app-like viewport in app/(app)/layout.tsx.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // cover: the page runs edge to edge in the installed app; every top bar adds env(safe-area-inset-top) so it sits
  // below the iPhone status bar (PublicHeader, styles/shell.css .sh-header, styles/signal.css .sg-top).
  viewportFit: 'cover',
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
        {/*
          Pre-paint splash cover. The inline script decides before first paint
          whether the splash plays (rules in lib/splash.ts: installed PWA on open
          or after 5+ min away, and once after sign-up / sign-in; never on the
          website). If it will not play, the cover is hidden at once; if it will,
          the cover stays until SplashGate finishes (hard cap 8 s either way).
        */}
        <div
          id={SPLASH_COVER_ID}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#FAFAF8',
            pointerEvents: 'none',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: splashPrePaintScript() }} />
        <SplashGate />
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
