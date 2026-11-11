// lib/admin/screens/members.ts
// People · Members, backed by profiles, member_profile (stage, city, messaging block, facilitator) and circle_seats.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isOwnerUserId } from '@/lib/admin/api-guard';
import { deriveBilling } from '@/lib/billing-state';
import { planDisplayName } from '@/lib/plans-display';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "members",
  group: "People",
  title: "Members",
  sub: "Everyone on Ascentor. Open a member to change their stage, plan or messaging.",
  cols: [
    "Member",
    "Email",
    "Stage",
    "Plan",
    "Status",
    "City",
    "Circle",
    "Joined"
  ],
  statusCol: 4,
  actions: [
    {
      id: "make-leader",
      label: "Make Leader",
      admin: true,
      keep: true,
      done: "Now a Leader. They can be assigned to facilitate a Circle. Their plan is unchanged."
    },
    {
      id: "extend-trial-7-days",
      label: "Extend 7 days",
      admin: true,
      keep: true,
      done: "Extended by 7 days."
    },
    {
      id: "block-messaging",
      label: "Block messaging",
      col: 4,
      to: "Messaging blocked",
      confirm: "They can still read, but can’t send messages until you restore it."
    },
    {
      id: "restore",
      label: "Restore",
      col: 4,
      to: "Active",
      when: "Messaging blocked"
    },
    {
      id: "delete-account",
      label: "Delete account",
      col: 4,
      to: "Removed by admin",
      admin: true,
      danger: true,
      confirm: "This permanently deletes the account and personal data. It can’t be undone."
    }
  ],
  buttons: [
    {
      id: "invite-leader",
      label: "Invite a Leader",
      href: "/admin/c/members/leaders"
    },
    {
      id: "groups",
      label: "Groups",
      needs: "view",
      href: "/admin/c/members/groups"
    },
    {
      id: "export-csv",
      label: "Export CSV",
      needs: "full"
    }
  ]
};

const TZ = 'Africa/Lagos';
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' }) : '-');
const num = (n: number) => n.toLocaleString('en-GB');

interface Prof { id: string; full_name: string | null; email: string | null; subscription_plan: string | null; subscription_status: string | null; subscription_end: string | null; created_at: string | null }

function statusOf(p: Prof, blocked: boolean): string {
  if (blocked) return 'Messaging blocked';
  const b = deriveBilling(p);
  return { active: 'Active', trialEnding: 'First period', failed: 'Past due', lapsed: 'Light access', cancelled: 'Cancelled', none: 'Free' }[b.state];
}

type Seat = { user_id: string; role: string; circles: { name: string; number: number } | { name: string; number: number }[] | null };

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, subscription_plan, subscription_status, subscription_end, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const profs = (data ?? []) as Prof[];
    const ids = profs.map((p) => p.id);

    const [mp, seats, all] = await Promise.all([
      ids.length ? supabaseAdmin.from('member_profile').select('user_id, stage, city, messaging_blocked, is_facilitator').in('user_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabaseAdmin.from('circle_seats').select('user_id, role, circles(name, number)').in('user_id', ids) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('profiles').select('subscription_plan, subscription_status, subscription_end').limit(20000),
    ]);
    const mpBy = new Map(((mp.data ?? []) as { user_id: string; stage: string | null; city: string | null; messaging_blocked: boolean | null; is_facilitator: boolean | null }[]).map((r) => [r.user_id, r]));
    const seatBy = new Map<string, Seat>();
    for (const r of (seats.data ?? []) as unknown as Seat[]) if (!seatBy.has(r.user_id) || r.role === 'facilitator') seatBy.set(r.user_id, r);

    const rows = profs.map((p) => {
      const m = mpBy.get(p.id);
      const seat = seatBy.get(p.id);
      const c = Array.isArray(seat?.circles) ? seat?.circles[0] : seat?.circles;
      const circle = c ? `${c.name || `Circle ${c.number}`}${seat?.role === 'facilitator' ? ' · facilitator' : ''}` : m?.is_facilitator ? 'Leader, no Circle yet' : 'None';
      return {
        id: p.id,
        cells: [p.full_name?.trim() || p.email || 'Member', p.email || '-', m?.stage || '-', planDisplayName(p.subscription_plan), statusOf(p, !!m?.messaging_blocked), m?.city || '-', circle, day(p.created_at)],
      };
    });

    const everyone = (all.data ?? []) as Prof[];
    let paying = 0, first = 0, light = 0;
    for (const p of everyone) {
      const b = deriveBilling(p);
      if (b.state === 'active') paying++;
      else if (b.state === 'trialEnding') first++;
      else if (b.state === 'lapsed') light++;
    }
    const weekAgo = Date.now() - 7 * 864e5;
    const joined = profs.filter((p) => p.created_at && new Date(p.created_at).getTime() > weekAgo).length;
    return {
      rows,
      kpis: [
        { label: 'Members', value: num(everyone.length), note: `+${num(joined)} this week` },
        { label: 'Paying', value: num(paying), note: 'Seeker, Builder, Pinnacle and Leader' },
        { label: 'First period', value: num(first), note: 'Paid, with 7 extra days' },
        { label: 'Light access', value: num(light), note: 'Payment failed or lapsed' },
      ],
      note: profs.length >= 200 ? 'Showing the 200 newest members.' : undefined,
    };
  },

  async act(ctx, actionId, rowId) {
    const { data: p } = await supabaseAdmin.from('profiles').select('id, full_name, role, subscription_status, subscription_end').eq('id', rowId).maybeSingle();
    if (!p) return { ok: false, error: 'We could not find that member.' };
    if (!ctx.isOwner && (await isOwnerUserId(rowId))) return { ok: false, error: 'This account cannot be changed.' };
    const now = new Date().toISOString();
    const saveFail = { ok: false, error: 'We could not save that. Please try again.' };

    if (actionId === 'make-leader') {
      const { data: mp } = await supabaseAdmin.from('member_profile').select('is_facilitator').eq('user_id', rowId).maybeSingle();
      if (mp?.is_facilitator) return { ok: false, error: 'They are already a Leader.' };
      const { error } = await supabaseAdmin.from('member_profile').upsert({ user_id: rowId, is_facilitator: true, updated_at: now }, { onConflict: 'user_id' });
      return error ? saveFail : { ok: true };
    }

    if (actionId === 'extend-trial-7-days') {
      const live = ['active', 'trialing'].includes(p.subscription_status ?? '');
      if (!live || !p.subscription_end) return { ok: false, error: 'Only a member with an active or first-period plan can be extended.' };
      const base = Math.max(new Date(p.subscription_end).getTime(), Date.now());
      const end = new Date(base + 7 * 864e5).toISOString();
      const { error } = await supabaseAdmin.from('profiles').update({ subscription_end: end, updated_at: now }).eq('id', rowId);
      return error ? saveFail : { ok: true, message: `Extended by 7 days, to ${day(end)}.` };
    }

    if (actionId === 'block-messaging' || actionId === 'restore') {
      const blocked = actionId === 'block-messaging';
      const { error } = await supabaseAdmin.from('member_profile').upsert({ user_id: rowId, messaging_blocked: blocked, updated_at: now }, { onConflict: 'user_id' });
      return error ? saveFail : { ok: true };
    }

    if (actionId === 'delete-account') {
      if (rowId === ctx.userId) return { ok: false, error: 'You cannot delete your own account.' };
      if (['admin', 'moderator'].includes(p.role)) return { ok: false, error: 'Staff accounts have to be removed from Team and access first.' };
      const { count } = await supabaseAdmin.from('partners').select('id', { count: 'exact', head: true }).eq('owner_id', rowId);
      if ((count ?? 0) > 0) return { ok: false, error: 'This account owns a partner platform. Transfer or close it first.' };
      try {
        const { data: files } = await supabaseAdmin.storage.from('avatars').list('avatars', { search: rowId });
        const mine = (files ?? []).filter((f) => f.name.startsWith(rowId)).map((f) => `avatars/${f.name}`);
        if (mine.length) await supabaseAdmin.storage.from('avatars').remove(mine);
      } catch { /* avatar clean-up is best effort */ }
      await supabaseAdmin.from('summit_registrations').delete().eq('user_id', rowId);
      await supabaseAdmin.from('audit_logs').insert({ user_id: null, action: 'account_deleted', entity_type: 'user', entity_id: rowId, details: { by: 'admin_console', deleted_at: now } });
      const { error } = await supabaseAdmin.auth.admin.deleteUser(rowId);
      if (error) return { ok: false, error: 'We could not delete that account. Nothing was removed.' };
      return { ok: true, message: 'Account deleted.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
