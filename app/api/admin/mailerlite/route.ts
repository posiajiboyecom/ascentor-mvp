import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// API — /api/admin/mailerlite
// GET  → fetches subscriber stats, groups, recent campaigns
// Protected: admin/moderator only
// Env: MAILERLITE_API_KEY
// ============================================================

const ML_BASE = 'https://connect.mailerlite.com/api';

async function mlFetch(path: string) {
  const res = await fetch(`${ML_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // cache 5 mins
  });
  if (!res.ok) throw new Error(`MailerLite ${path} → ${res.status}`);
  return res.json();
}

export async function GET() {
  // ── Auth guard ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.MAILERLITE_API_KEY) {
    return NextResponse.json({ error: 'MAILERLITE_API_KEY not set' }, { status: 500 });
  }

  try {
    // Fetch in parallel
    const [subsRes, groupsRes, campaignsRes] = await Promise.all([
      mlFetch('/subscribers?limit=1&filter[status]=active'),
      mlFetch('/groups?limit=25'),
      mlFetch('/campaigns?limit=10'),
    ]);

    // ── Subscriber stats ──────────────────────────────────
    const totalSubscribers  = subsRes.meta?.total      || 0;
    const activeSubscribers = subsRes.meta?.total      || 0;

    // ── Groups ────────────────────────────────────────────
    const groups = (groupsRes.data || []).map((g: any) => ({
      id:    g.id,
      name:  g.name,
      total: g.total_count || 0,
    }));

    // ── Campaigns — calc avg open/click rates ─────────────
    const campaigns = (campaignsRes.data || []).map((c: any) => ({
      id:           c.id,
      name:         c.name,
      subject:      c.emails?.[0]?.subject || c.name,
      opens_count:  c.stats?.opens_count  || 0,
      clicks_count: c.stats?.clicks_count || 0,
      sent_at:      c.scheduled_for       || null,
      status:       c.status,
      open_rate:    c.stats?.open_rate    || 0,
      click_rate:   c.stats?.click_rate   || 0,
    }));

    const avgOpenRate = campaigns.length
      ? Math.round(campaigns.reduce((s: number, c: any) => s + c.open_rate, 0) / campaigns.length * 10) / 10
      : 0;

    const avgClickRate = campaigns.length
      ? Math.round(campaigns.reduce((s: number, c: any) => s + c.click_rate, 0) / campaigns.length * 10) / 10
      : 0;

    // ── Unsubscribed count ────────────────────────────────
    let unsubscribed = 0;
    try {
      const unsubRes = await mlFetch('/subscribers?limit=1&filter[status]=unsubscribed');
      unsubscribed = unsubRes.meta?.total || 0;
    } catch { /* non-critical */ }

    return NextResponse.json({
      totalSubscribers,
      activeSubscribers,
      avgOpenRate,
      avgClickRate,
      unsubscribed,
      groups,
      recentCampaigns: campaigns,
    });

  } catch (err: any) {
    console.error('MailerLite API error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/mailerlite
// action: "sync"         — sync all Supabase users → MailerLite
// action: "sync-user"    — sync a single email
// action: "get-groups"   — list all ML groups (for diagnostics)
// action: "ensure-groups"— create missing groups, return IDs
// ============================================================
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'MAILERLITE_API_KEY not set in Vercel env vars' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'sync';

  // ── Helper: raw ML fetch ────────────────────────────────────
  async function ml(path: string, method = 'GET', payload?: object) {
    const res = await fetch(`https://connect.mailerlite.com/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `ML ${res.status} ${path}`);
    return json;
  }

  // ── get-groups: return all ML groups ───────────────────────
  if (action === 'get-groups') {
    try {
      const data = await ml('/groups?limit=100');
      return NextResponse.json({ groups: data?.data || [] });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── ensure-groups: create any missing groups, return ID map ─
  async function ensureGroups(): Promise<Record<string, string>> {
    const needed = [
      { key: 'APP_USERS',  name: 'Ascentor — App Users',    env: 'MAILERLITE_GROUP_APP_USERS'  },
      { key: 'FREE_USERS', name: 'Ascentor — Free Users',   env: 'MAILERLITE_GROUP_FREE_USERS' },
      { key: 'PAID_USERS', name: 'Ascentor — Paid Users',   env: 'MAILERLITE_GROUP_PAID_USERS' },
      { key: 'NEWSLETTER', name: 'Ascentor — Newsletter',   env: 'MAILERLITE_GROUP_NEWSLETTER' },
    ];

    // Check env vars first
    const fromEnv: Record<string, string> = {};
    let allSet = true;
    for (const g of needed) {
      const id = process.env[g.env];
      if (id) {
        fromEnv[g.key] = id;
      } else {
        allSet = false;
      }
    }
    if (allSet) return fromEnv;

    // Fetch existing groups from ML
    const existing = await ml('/groups?limit=100');
    const existingMap: Record<string, string> = {};
    for (const g of (existing?.data || [])) {
      existingMap[g.name] = g.id;
    }

    // Create any missing groups
    const result: Record<string, string> = { ...fromEnv };
    for (const g of needed) {
      if (result[g.key]) continue; // already from env
      if (existingMap[g.name]) {
        result[g.key] = existingMap[g.name];
      } else {
        // Create it
        try {
          const created = await ml('/groups', 'POST', { name: g.name });
          result[g.key] = created?.data?.id || '';
        } catch {
          result[g.key] = '';
        }
      }
    }
    return result;
  }

  if (action === 'ensure-groups') {
    try {
      const groups = await ensureGroups();
      return NextResponse.json({ groups });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── sync-user: single email ─────────────────────────────────
  if (action === 'sync-user') {
    const { email, firstName, groups: groupIds } = body;
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    try {
      await mlUpsert(ml, email, firstName || '', groupIds || []);
      return NextResponse.json({ ok: true, synced: 1 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── Full sync ───────────────────────────────────────────────
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Step 1: Ensure groups exist (creates them in ML if missing)
    const groupIds = await ensureGroups();

    // Step 2: Fetch all subscribers from Supabase
    const [{ data: nlSubs }, { data: appUsers }] = await Promise.all([
      service.from('newsletter_subscribers').select('email, first_name, source').eq('is_active', true),
      service.from('profiles').select('email, full_name, subscription_plan, subscription_status'),
    ]);

    // Step 3: Merge and deduplicate by email
    const map = new Map<string, { email: string; name: string; groups: string[] }>();

    for (const s of (nlSubs || [])) {
      if (!s.email) continue;
      const key = s.email.trim().toLowerCase();
      map.set(key, {
        email: key,
        name: s.first_name || '',
        groups: [groupIds.NEWSLETTER].filter(Boolean),
      });
    }

    for (const u of (appUsers || [])) {
      if (!u.email) continue;
      const key = u.email.trim().toLowerCase();
      const existing = map.get(key) || { email: key, name: '', groups: [] as string[] };

      if (groupIds.APP_USERS && !existing.groups.includes(groupIds.APP_USERS)) {
        existing.groups.push(groupIds.APP_USERS);
      }

      const isPaid = (u.subscription_status === 'active' || u.subscription_status === 'trialing')
        && u.subscription_plan && u.subscription_plan !== 'free';

      if (isPaid) {
        if (groupIds.PAID_USERS && !existing.groups.includes(groupIds.PAID_USERS)) {
          existing.groups.push(groupIds.PAID_USERS);
        }
      } else {
        if (groupIds.FREE_USERS && !existing.groups.includes(groupIds.FREE_USERS)) {
          existing.groups.push(groupIds.FREE_USERS);
        }
      }

      const firstName = (u.full_name || '').split(' ')[0] || '';
      if (!existing.name && firstName) existing.name = firstName;

      map.set(key, existing);
    }

    const records = Array.from(map.values());
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Step 4: Upsert in batches of 25
    const BATCH = 25;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (r) => {
          try {
            await mlUpsert(ml, r.email, r.name, r.groups);
            synced++;
          } catch (err: any) {
            failed++;
            errors.push(`${r.email}: ${err.message}`);
          }
        })
      );
      if (i + BATCH < records.length) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    return NextResponse.json({
      ok: true,
      total: records.length,
      synced,
      failed,
      groups: groupIds,
      errors: errors.slice(0, 20),
    });

  } catch (err: any) {
    console.error('[mailerlite sync]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── MailerLite upsert helper ─────────────────────────────────
async function mlUpsert(email: string, name: string, groups: string[]) {
  const validGroups = groups.filter(Boolean);
  const body: Record<string, any> = {
    email: email.trim().toLowerCase(),
    fields: { name: name || '' },
    status: 'active',
    resubscribe: true,
  };
  if (validGroups.length > 0) body.groups = validGroups;

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204 || res.status === 200 || res.status === 201) return;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `MailerLite ${res.status}`);
  }
}
