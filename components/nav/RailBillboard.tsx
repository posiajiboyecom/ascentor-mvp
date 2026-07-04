'use client';

// components/nav/RailBillboard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Three ad/promo billboard slots rendered in the desktop rail between the
// nav items and the Summit card. Each slot is independently managed from
// Admin → Events → Rail Billboards (/admin/billboards).
//
// Schema: rail_billboards
//   id, slot (1|2|3), title, body, cta_label, cta_url,
//   bg_color, accent_color, is_active, sort_order, created_at
//
// Fallback: if a slot has no active billboard, it renders a compact
// placeholder that stays invisible to users (height: 0) so the rail
// doesn't have awkward gaps.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export interface Billboard {
  id: string;
  slot: number;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  bg_color: string;
  accent_color: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function BillboardCard({ b }: { b: Billboard }) {
  const bg     = b.bg_color     || '#161412';
  const accent = b.accent_color || '#C8A96E';

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${accent}22`,
        background: bg,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Accent top bar */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
      }} />

      {/* Image (optional) */}
      {b.image_url && (
        <div style={{ position: 'relative', width: '100%', height: 80, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.image_url}
            alt={b.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Gradient overlay so text on top of image is readable */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${bg} 100%)`,
          }} />
        </div>
      )}

      <div style={{ padding: b.image_url ? '6px 12px 12px' : '12px' }}>
        {/* Title */}
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: 0,
          marginBottom: b.body ? 4 : b.cta_label ? 8 : 0,
          fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
        }}>
          {b.title}
        </p>

        {/* Body */}
        {b.body && (
          <p style={{
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.65)',
            margin: 0,
            marginBottom: b.cta_label ? 10 : 0,
            lineHeight: 1.5,
            fontFamily: "var(--font-body, 'Inter', sans-serif)",
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {b.body}
          </p>
        )}

        {/* CTA */}
        {b.cta_label && b.cta_url && (
          <Link
            href={b.cta_url}
            target={b.cta_url.startsWith('http') ? '_blank' : undefined}
            rel={b.cta_url.startsWith('http') ? 'noopener noreferrer' : undefined}
            style={{
              display: 'inline-block',
              padding: '5px 12px',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              background: `${accent}22`,
              color: accent,
              border: `1px solid ${accent}44`,
              textDecoration: 'none',
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              transition: 'background 0.15s',
            }}
          >
            {b.cta_label} →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function RailBillboard() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('rail_billboards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(3)
      .then(({ data }) => {
        if (data) setBillboards(data);
      });
  }, []);

  if (billboards.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '0 16px',
      marginBottom: 8,
      maxHeight: '38vh',
      overflowY: 'auto',
    }}>
      {billboards.map((b) => (
        <BillboardCard key={b.id} b={b} />
      ))}
    </div>
  );
}
