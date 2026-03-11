// ============================================================
// WHITE-LABEL SHELL LAYOUT
// app/p/[subdomain]/layout.tsx
//
// Every partner page renders inside this layout.
// It injects brand CSS vars, partner fonts, and logo.
// The user sees the partner's brand — not "Ascentor".
// ============================================================

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPartnerContext } from '@/lib/getPartnerContext';
import { PartnerProvider } from '@/components/partner/PartnerProvider';

export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  await params; // Next.js 15+ requires params to be awaited
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  const ctx = await getPartnerContext(hostname);

  // If subdomain doesn't resolve to an active partner, 404
  if (!ctx.isWhiteLabel) {
    notFound();
  }

  const { partner, cssVars } = ctx;
  const brand = partner.brand;

  // Build CSS var string for inline injection
  const cssVarString = Object.entries(cssVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  // Google Fonts URL for partner's chosen fonts
  const fontsNeeded = [...new Set([brand.font_heading, brand.font_body])];
  const fontFamilies = fontsNeeded.map(f =>
    `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`
  ).join('&');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{brand.platform_name}</title>
        {brand.tagline && <meta name="description" content={brand.tagline} />}

        {/* Partner favicon */}
        {brand.favicon_url && (
          <link rel="icon" href={brand.favicon_url} />
        )}

        {/* Partner fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`}
          rel="stylesheet"
        />

        {/* Partner brand CSS vars — overrides Ascentor defaults */}
        <style>{`
          :root { ${cssVarString}; }

          * { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            background: var(--bg);
            color: var(--text);
            font-family: var(--font-body, 'Syne', sans-serif);
            min-height: 100vh;
          }

          h1, h2, h3 {
            font-family: var(--font-heading, 'Cormorant Garamond', Georgia, serif);
          }

          /* Resets for inputs to pick up partner colours */
          input, select, textarea {
            background: var(--bg-input);
            color: var(--text);
            border: 1px solid var(--border);
          }

          /* Scrollbar tinted to brand */
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: var(--bg); }
          ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }
        `}</style>
      </head>
      <body style={{ background: 'var(--bg)' }}>
        <PartnerProvider context={ctx}>
          {children}
        </PartnerProvider>
      </body>
    </html>
  );
}

// ── Dynamic metadata per partner ─────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  await params; // Next.js 15+ requires params to be awaited
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const ctx = await getPartnerContext(hostname);

  if (!ctx.isWhiteLabel) return {};

  const { brand } = ctx.partner;
  return {
    title: brand.platform_name,
    description: brand.tagline,
    icons: brand.favicon_url ? [{ url: brand.favicon_url }] : [],
  };
}
