import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { ModalProvider } from '@/components/Modal';
import { NotificationProvider } from '@/components/Notifications';
import PushPermission from '@/components/PushPermission';
import { MobileInit } from '@/components/MobileInit';
import Script from 'next/script';

// ── Fonts ──────────────────────────────────────────────────────────
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  style: ['normal', 'italic'],
  variable: '--font-accent',
  display: 'swap',
});

// ── Metadata ───────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: 'Ascentor — Build a life that outlasts you.',
    template: '%s | Ascentor',
  },
  description:
    'Ascentor is the platform of The Elevation Summit — a global community of purposeful individuals building lives of meaning, leadership, and lasting impact.',
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
    title: 'Ascentor — The Elevation Summit Platform',
    description:
      'Join a global community of purposeful individuals. The official platform of The Elevation Summit movement.',
    url: 'https://ascentorbi.com',
    siteName: 'Ascentor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascentor — Build a life that outlasts you.',
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required here because the inline theme
    // script sets data-app-theme before React hydrates, causing a mismatch.
    // This is intentional and safe — it only suppresses the warning on <html>.
    <html
      lang="en"
      className={`${plusJakarta.variable} ${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon/icon-192.png" />

        {/* Theme initialiser — runs synchronously before paint to prevent flash.
            Sets data-app-theme on <html> before React hydrates.
            suppressHydrationWarning on <html> above handles the mismatch. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('asc-theme');
                  var explicit = localStorage.getItem('asc-theme-explicit');
                  var theme = (stored === 'dark' && explicit === '1') ? 'dark'
                            : (stored === 'light') ? 'light'
                            : 'light';
                  document.documentElement.setAttribute('data-app-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* Plausible Analytics */}
        <Script
          defer
          data-domain="ascentorbi.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <ModalProvider>
          <NotificationProvider>
            <MobileInit />
            {children}
            <PWAInstallPrompt />
            <PushPermission />
          </NotificationProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
