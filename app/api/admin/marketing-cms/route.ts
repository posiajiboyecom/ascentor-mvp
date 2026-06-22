// app/api/admin/marketing-cms/route.ts
// ============================================================
// Admin-only: full read/write for the marketing CMS.
// Auth pattern matches every other /api/admin/* route in this
// codebase — Bearer token resolved against a request-scoped anon
// client, then role-checked via the service-role client.
//
// Unlike the public reader (lib/supabase/queries/marketing.ts),
// THIS route is allowed to return draft_data — it's gated by the
// same admin/moderator role check as every other admin route, not
// by RLS alone. Never expose this route's GET response to anything
// other than the authenticated admin UI.
//
// GET  /api/admin/marketing-cms                  -> list all pages with section counts
// GET  /api/admin/marketing-cms?slug=landing      -> one page, full detail (draft + published, sections + items)
// PATCH /api/admin/marketing-cms                  -> one action per call, see ACTION below
//
// PATCH body shape: { action, ...actionSpecificFields }
//   action: 'save_section_draft'
//     { sectionId, draftData }
//   action: 'publish_section'
//     { sectionId }   — copies draft_data -> published_data for the section AND all its repeating items
//   action: 'unpublish_section'
//     { sectionId }   — sets section status back to draft; published_data is LEFT INTACT (so the
//                        live site keeps showing the last published version) until publish_section
//                        is called again or the section is deleted. Unpublishing only stops it from
//                        appearing in admin's "published" filter — it does NOT clear published_data,
//                        because that would mean unpublishing accidentally blanks the live page.
//   action: 'save_item_draft'
//     { itemId, draftData }
//   action: 'create_item'
//     { sectionId, draftData }   — new repeating item (FAQ entry, persona card, etc.), starts as draft
//   action: 'delete_item'
//     { itemId }                — hard delete, no undo (matches the hard-delete precedent already
//                                  established for coaching_sessions in this codebase)
//   action: 'reorder_items'
//     { itemIds: string[] }     — array in desired order; sort_order is set to array index
//   action: 'create_section'
//     { pageId, sectionKey, label, sectionType }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminUser(authHeader: string | null) {
  if (!authHeader) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return null;
  return user;
}

// ── GET ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser(req.headers.get('authorization'));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    // ── List mode: all pages + section counts ──
    if (!slug) {
      const { data: pages, error: pagesErr } = await supabaseAdmin
        .from('marketing_pages')
        .select('id, slug, title, route, status, description, updated_at')
        .order('title');
      if (pagesErr) throw pagesErr;

      const { data: sectionCounts, error: countsErr } = await supabaseAdmin
        .from('marketing_sections')
        .select('page_id, status');
      if (countsErr) throw countsErr;

      const counts: Record<string, { published: number; draft: number }> = {};
      for (const row of sectionCounts || []) {
        if (!counts[row.page_id]) counts[row.page_id] = { published: 0, draft: 0 };
        counts[row.page_id][row.status as 'published' | 'draft']++;
      }

      const enriched = (pages || []).map(p => ({
        ...p,
        sectionCounts: counts[p.id] || { published: 0, draft: 0 },
      }));

      return NextResponse.json({ pages: enriched });
    }

    // ── Detail mode: one page, full draft + published content ──
    const { data: page, error: pageErr } = await supabaseAdmin
      .from('marketing_pages')
      .select('*')
      .eq('slug', slug)
      .single();
    if (pageErr || !page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const { data: sections, error: sectionsErr } = await supabaseAdmin
      .from('marketing_sections')
      .select('*')
      .eq('page_id', page.id)
      .order('sort_order');
    if (sectionsErr) throw sectionsErr;

    const sectionIds = (sections || []).map(s => s.id);
    let items: any[] = [];
    if (sectionIds.length > 0) {
      const { data: itemRows, error: itemsErr } = await supabaseAdmin
        .from('marketing_repeating_items')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order');
      if (itemsErr) throw itemsErr;
      items = itemRows || [];
    }

    const sectionsWithItems = (sections || []).map(s => ({
      ...s,
      items: items.filter(i => i.section_id === s.id),
    }));

    return NextResponse.json({ page, sections: sectionsWithItems });
  } catch (err: any) {
    console.error('[admin marketing-cms GET]', err);
    return NextResponse.json({ error: err.message || 'Fetch failed' }, { status: 500 });
  }
}

// ── PATCH ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAdminUser(req.headers.get('authorization'));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const action: string | undefined = body?.action;
    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    switch (action) {
      case 'save_section_draft': {
        const { sectionId, draftData } = body;
        if (!sectionId || draftData === undefined) {
          return NextResponse.json({ error: 'sectionId and draftData required' }, { status: 400 });
        }
        const { error } = await supabaseAdmin
          .from('marketing_sections')
          .update({ draft_data: draftData })
          .eq('id', sectionId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case 'publish_section': {
        const { sectionId } = body;
        if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 });

        // Fetch current draft_data so we can copy it to published_data
        // in the same call — Supabase doesn't support "set column A
        // to column B's current value" via .update() directly, so
        // this is fetch-then-write rather than a single SQL UPDATE.
        // Not atomic against a concurrent edit between the two calls,
        // but that's an acceptable risk for a single-admin editing
        // tool — flagging rather than building optimistic-locking
        // for a problem that doesn't exist yet.
        const { data: section, error: fetchErr } = await supabaseAdmin
          .from('marketing_sections')
          .select('draft_data')
          .eq('id', sectionId)
          .single();
        if (fetchErr || !section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

        const { error: updateErr } = await supabaseAdmin
          .from('marketing_sections')
          .update({
            published_data: section.draft_data,
            status: 'published',
            published_at: new Date().toISOString(),
          })
          .eq('id', sectionId);
        if (updateErr) throw updateErr;

        // For repeating sections, publish every draft item too — a
        // FAQ section being "published" should mean every FAQ entry
        // in it goes live, not just the section shell. Items the
        // admin hasn't touched yet (draft_data === published_data
        // already) are harmless to re-publish; no special-casing
        // needed.
        const { data: items, error: itemsFetchErr } = await supabaseAdmin
          .from('marketing_repeating_items')
          .select('id, draft_data')
          .eq('section_id', sectionId);
        if (itemsFetchErr) throw itemsFetchErr;

        if (items && items.length > 0) {
          await Promise.all(items.map(item =>
            supabaseAdmin
              .from('marketing_repeating_items')
              .update({
                published_data: item.draft_data,
                status: 'published',
                published_at: new Date().toISOString(),
              })
              .eq('id', item.id)
          ));
        }

        return NextResponse.json({ ok: true });
      }

      case 'unpublish_section': {
        const { sectionId } = body;
        if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 });
        // published_data deliberately NOT cleared — see header comment.
        const { error } = await supabaseAdmin
          .from('marketing_sections')
          .update({ status: 'draft' })
          .eq('id', sectionId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case 'save_item_draft': {
        const { itemId, draftData } = body;
        if (!itemId || draftData === undefined) {
          return NextResponse.json({ error: 'itemId and draftData required' }, { status: 400 });
        }
        const { error } = await supabaseAdmin
          .from('marketing_repeating_items')
          .update({ draft_data: draftData })
          .eq('id', itemId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case 'create_item': {
        const { sectionId, draftData } = body;
        if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 });

        const { count } = await supabaseAdmin
          .from('marketing_repeating_items')
          .select('id', { count: 'exact', head: true })
          .eq('section_id', sectionId);

        const { data, error } = await supabaseAdmin
          .from('marketing_repeating_items')
          .insert({ section_id: sectionId, draft_data: draftData || {}, sort_order: count ?? 0 })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, item: data });
      }

      case 'delete_item': {
        const { itemId } = body;
        if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
        const { error } = await supabaseAdmin
          .from('marketing_repeating_items')
          .delete()
          .eq('id', itemId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case 'reorder_items': {
        const { itemIds } = body;
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
          return NextResponse.json({ error: 'itemIds must be a non-empty array' }, { status: 400 });
        }
        await Promise.all(
          itemIds.map((id: string, idx: number) =>
            supabaseAdmin.from('marketing_repeating_items').update({ sort_order: idx }).eq('id', id)
          )
        );
        return NextResponse.json({ ok: true });
      }

      case 'create_section': {
        const { pageId, sectionKey, label, sectionType } = body;
        if (!pageId || !sectionKey || !label || !sectionType) {
          return NextResponse.json({ error: 'pageId, sectionKey, label, sectionType required' }, { status: 400 });
        }
        if (!['prose', 'repeating', 'structured'].includes(sectionType)) {
          return NextResponse.json({ error: 'Invalid sectionType' }, { status: 400 });
        }

        const { count } = await supabaseAdmin
          .from('marketing_sections')
          .select('id', { count: 'exact', head: true })
          .eq('page_id', pageId);

        const { data, error } = await supabaseAdmin
          .from('marketing_sections')
          .insert({
            page_id: pageId,
            section_key: sectionKey,
            label,
            section_type: sectionType,
            sort_order: count ?? 0,
            draft_data: {},
          })
          .select()
          .single();

        if (error) {
          // Most likely cause: unique(page_id, section_key) violation
          if (error.code === '23505') {
            return NextResponse.json({ error: `A section with key "${sectionKey}" already exists on this page` }, { status: 409 });
          }
          throw error;
        }
        return NextResponse.json({ ok: true, section: data });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin marketing-cms PATCH]', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
