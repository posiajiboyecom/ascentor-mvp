// app/p/[subdomain]/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────

// CRITICAL: Prevent build-time static pre-rendering — this layout fetches
// tenant config from Supabase and must only run at request time, not build time.
export const dynamic = 'force-dynamic';
// WHITE-LABEL TENANT LAYOUT
// Loaded for every request on a partner subdomain: acme.ascentor.co/*
//
// Responsibilities:
//  1. Read the [subdomain] param from the URL
//  2. Fetch the tenant config from Supabase
//  3. Inject CSS variables for the tenant's branding
//  4. Render a 404-style page if the tenant doesn't exist
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

// ── Types ───────────────────────────────────────────────────────────────────

interface TenantConfig {
  id: string;
  subdomain: string;
  name: string;
  logo_url: string | null;
  favicon_url: string | null;
  accent_color: string;      // hex e.g. "#14b8a6"
  accent_hover: string;      // hex e.g. "#0f9488"
  accent_text: string;       // hex e.g. "#000000" (text on accent bg)
  bg_color: string;          // e.g. "#0f172a"
  surface_color: string;     // e.g. "#1e293b"
  text_color: string;        // e.g. "#f8fafc"
  text_muted: string;        // e.g. "#94a3b8"
  ai_persona_prompt: string;
  is_active: boolean;
}

// ── Data Fetching ────────────────────────────────────────────────────────────

async function getTenant(subdomain: string): Promise<TenantConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('subdomain', subdomain.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as TenantConfig;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const tenant = await getTenant(subdomain);

  if (!tenant) {
    return { title: 'Not Found' };
  }

  return {
    title: {
      default: tenant.name,
      template: `%s | ${tenant.name}`,
    },
    description: `AI-powered coaching platform by ${tenant.name}`,
    icons: tenant.favicon_url ? { icon: tenant.favicon_url } : undefined,
  };
}

// ── Layout ───────────────────────────────────────────────────────────────────

export default async function SubdomainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const tenant = await getTenant(subdomain);

  // Hard 404 if subdomain not registered
  if (!tenant) {
    notFound();
  }

  // Build CSS variables from tenant config
  // These override the default Ascentor theme throughout the subtree
  const cssVars = `
    :root {
      --accent: ${tenant.accent_color};
      --accent-hover: ${tenant.accent_hover};
      --accent-text: ${tenant.accent_text};
      --bg: ${tenant.bg_color};
      --surface: ${tenant.surface_color};
      --text: ${tenant.text_color};
      --text-muted: ${tenant.text_muted};
      --teal: ${tenant.accent_color};
      --border: rgba(255,255,255,0.1);
    }
  `.trim();

  return (
    <>
      {/* Inject tenant theme variables */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />

      {/* Pass tenant context to all child server/client components via a data attr */}
      {/* Client components can read this via document.documentElement.dataset.tenant */}
      <div
        data-tenant={tenant.id}
        data-tenant-name={tenant.name}
        style={{ minHeight: '100vh' }}
      >
        {children}
      </div>
    </>
  );
}
