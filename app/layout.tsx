import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { ModalProvider } from '@/components/Modal';
import { NotificationProvider } from '@/components/Notifications';
import PushPermission from '@/components/PushPermission';
import Script from 'next/script'; // <-- 1. Import the Script component

export const metadata: Metadata = {
  title: 'Ascentor — AI-Powered Leadership Development',
  description: 'Accelerate your leadership journey with Sage AI, expert mentors, and peer communities. Built for ambitious professionals.',
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
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0C0B08', // Ascentor Dark — Brand Book v1.0
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon/icon-192.png" />

        {/* Theme initialiser — runs synchronously before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('asc-theme');
                  var theme = (stored === 'light' || stored === 'dark')
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-app-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* Plausible Analytics */}
        <Script
          defer
          data-domain="ascentor-mvp.vercel.app"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <ModalProvider>
          <NotificationProvider>
            {children}
            <PWAInstallPrompt />
            <PushPermission />
          </NotificationProvider>
        </ModalProvider>
      </body>
    </html>
  );
}