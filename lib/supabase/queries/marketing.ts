// lib/supabase/queries/marketing.ts
// ============================================================
// Public-facing reads for the marketing CMS — landing page,
// elevation-summit, movement, about, how-it-works, who-its-for,
// products (page copy only, not the product listing itself).
//
// CONTRACT: every function in this file selects published_data
// ONLY, never draft_data. This is the enforcement point for the
// draft/publish workflow described in
// database/migrations/001_marketing_cms_schema.sql — RLS allows
// public read of the whole row (Postgres RLS is row-level, not
// column-level, so it can't hide draft_data from anon by itself),
// so THIS FILE is what actually keeps unpublished content from
// leaking to visitors. Do not add a function here that returns
// draft_data to an unauthenticated caller. The admin-side reader
// (lib/supabase/queries/marketing-admin.ts, built separately,
// service-role gated) is the only place draft_data should surface.
//
// Tables touched: marketing_pages, marketing_sections,
// marketing_repeating_items.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import type { MarketingSection, Json } from '@/database/database';

// ── Public shapes ─────────────────────────────────────────────
// What page components actually consume — published content only,
// repeating items already resolved and attached to their section,
// everything pre-sorted. Components should never need to touch
// draft_data, status, or published_at; those are admin-only concerns
// stripped out here.

export interface PublishedSection {
  sectionKey: string;
  label:      string;
  type:       MarketingSection['section_type'];
  /** For 'prose' and 'structured' sections — the published content. Null if this section has never been published. */
  data:       Json | null;
  /** For 'repeating' sections only — published items, sorted, draft-only items excluded. Empty array for non-repeating sections. */
  items:      Json[];
}

export interface PublishedPage {
  slug:     string;
  title:    string;
  route:    string;
  sections: Record<string, PublishedSection>; // keyed by section_key for O(1) lookup from page components
}

// ── getPublishedPage ────────────────────────────────────────
// Fetches one page's published content, keyed by section_key so a
// page component can do `sections.hero?.data` instead of finding by
// array index — array order can't be relied on to match what the
// component expects if an admin reorders sections, but the key is
// stable (it's chosen when the section is created, not derived from
// position).
//
// Returns null if the page doesn't exist or has never had ANY
// section published — callers should fall back to existing hardcoded
// JSX in that case (this is meant to be an incremental migration
// path, not a hard cutover — see usage note at bottom of this file).
export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  const supabase = await createClient();

  const { data: page, error: pageErr } = await supabase
    .from('marketing_pages')
    .select('id, slug, title, route')
    .eq('slug', slug)
    .single();

  if (pageErr || !page) {
    console.error(`[marketing-cms] page not found: ${slug}`, pageErr?.message);
    return null;
  }

  const { data: sectionRows, error: sectionsErr } = await supabase
    .from('marketing_sections')
    .select('id, section_key, label, section_type, sort_order, published_data, status')
    .eq('page_id', page.id)
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (sectionsErr) {
    console.error(`[marketing-cms] sections fetch failed for ${slug}:`, sectionsErr.message);
    return null;
  }

  if (!sectionRows || sectionRows.length === 0) {
    // Page exists but has no published sections yet — not an error,
    // just means this page hasn't been migrated to the CMS yet.
    return null;
  }

  // Repeating sections need their items fetched separately. Batch
  // this into one query across all repeating section IDs on this
  // page, rather than N queries (one per repeating section) — same
  // N+1 avoidance approach used in app/admin/coaching/page.tsx's
  // channel message counts.
  const repeatingSectionIds = sectionRows
    .filter(s => s.section_type === 'repeating')
    .map(s => s.id);

  let itemsBySection = new Map<string, Json[]>();
  if (repeatingSectionIds.length > 0) {
    const { data: itemRows, error: itemsErr } = await supabase
      .from('marketing_repeating_items')
      .select('section_id, sort_order, published_data')
      .in('section_id', repeatingSectionIds)
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    if (itemsErr) {
      console.error(`[marketing-cms] repeating items fetch failed for ${slug}:`, itemsErr.message);
      // Don't fail the whole page over this — sections without items
      // will just render empty, which is recoverable; a missing page
      // entirely is not.
    } else {
      itemsBySection = new Map();
      for (const row of itemRows || []) {
        const existing = itemsBySection.get(row.section_id) || [];
        existing.push(row.published_data);
        itemsBySection.set(row.section_id, existing);
      }
    }
  }

  const sections: Record<string, PublishedSection> = {};
  for (const row of sectionRows) {
    sections[row.section_key] = {
      sectionKey: row.section_key,
      label:      row.label,
      type:       row.section_type,
      data:       row.published_data,
      items:      row.section_type === 'repeating' ? (itemsBySection.get(row.id) || []) : [],
    };
  }

  return {
    slug:  page.slug,
    title: page.title,
    route: page.route,
    sections,
  };
}

// ============================================================
// USAGE NOTE FOR PAGE COMPONENTS
// ============================================================
// This is built for INCREMENTAL migration, not a hard cutover.
// A page component should do:
//
//   const cms = await getPublishedPage('landing');
//   const heroData = cms?.sections.hero?.data;
//
//   <h1>{heroData?.headline ?? 'Build a life that outlasts you.'}</h1>
//
// i.e. fall back to the CURRENT hardcoded copy if the CMS section
// doesn't exist yet or hasn't been published. This means pages can
// be migrated section-by-section without ever showing a blank page
// if admin hasn't filled something in. Do NOT remove the hardcoded
// fallback text when wiring a page to this — that text becomes the
// safety net for empty/unpublished content, not dead code to delete.
// ============================================================
