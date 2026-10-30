// lib/admin/screens/partners.ts
// Spec copied from the admin prototype (Marketing · Partners). The loader below is a placeholder until it reads real data.
import { fromAs } from '@/lib/contact';
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "partners",
  group: "Marketing",
  title: "Partners",
  sub: "Organisations with their own Ascentor space and a revenue share.",
  cols: [
    "Partner",
    "Type",
    "Members",
    "Revenue share",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "approve",
      label: "Approve",
      col: 4,
      to: "Active"
    },
    {
      id: "suspend",
      label: "Suspend",
      col: 4,
      to: "Suspended",
      confirm: "Their members keep access until the end of the month."
    },
    {
      id: "reject",
      label: "Reject",
      col: 4,
      to: "Rejected"
    }
  ],
  quick: 0
};

// Same rules as PATCH /api/admin/partners (the Partners page): approve activates, sets onboarded_at, opens a first subscription
// row and emails the owner; suspend emails the owner. partners.status only allows pending/active/suspended/churned.
const LABEL: Record<string, string> = { pending: 'Pending', active: 'Active', suspended: 'Suspended', churned: 'Churned', rejected: 'Rejected' };
const TIER_AMOUNT: Record<string, number> = { starter: 10000, growth: 30000, pro: 70000 };

async function emailOwner(ownerId: string | null, partner: { name: string; subdomain: string }, kind: 'approve' | 'suspend') {
  try {
    if (!ownerId) return;
    const { data: owner } = await supabaseAdmin.from('profiles').select('email').eq('id', ownerId).maybeSingle();
    if (!owner?.email) return;
    const [{ brandedEmailLayout, esc, p, goldButton }, { sendEmail }] = await Promise.all([import('@/lib/emailTemplate'), import('@/lib/nodemailer')]);
    const name = esc(partner.name);
    const approve = kind === 'approve';
    await sendEmail({
      from: fromAs('Ascentor Partners'),
      to: owner.email,
      subject: approve ? `Your partner application is approved, ${partner.name}` : `Your partner account has been suspended, ${partner.name}`,
      html: brandedEmailLayout({
        preheader: approve ? `${partner.name} is now live.` : `Your partner account ${partner.name} has been suspended.`,
        eyebrow: approve ? 'Partner Application' : 'Partner Account',
        heading: approve ? "You're approved." : 'Account suspended.',
        recipient: owner.email,
        content: approve
          ? p(`Your partner platform <strong>${name}</strong> is now live at <a href="https://${esc(partner.subdomain)}.joinascentor.com" style="color:#C8A96E;text-decoration:none;">${esc(partner.subdomain)}.joinascentor.com</a>.`) +
            p('Head to your partner dashboard to customise your brand and invite members.') +
            goldButton('Go to Partner Dashboard →', 'https://joinascentor.com/partner/brand')
          : p(`Your partner account <strong>${name}</strong> has been suspended. Contact support for more information.`),
      }),
    });
  } catch (e) {
    console.warn('[admin partners] email error (non-fatal):', e);
  }
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('partners')
      .select('id, name, status, revenue_share_percent').order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const members: Record<string, number> = {};
    const { data: m } = await supabaseAdmin.from('partner_members').select('partner_id').neq('status', 'removed').limit(50000);
    (m ?? []).forEach((x: any) => { members[x.partner_id] = (members[x.partner_id] || 0) + 1; });
    return {
      rows: (data ?? []).map((r: any) => ({
        id: String(r.id),
        cells: [r.name || '-', '-', members[r.id] ? count(members[r.id]) : '-', r.revenue_share_percent != null ? `${r.revenue_share_percent}%` : '-', LABEL[r.status] ?? r.status ?? '-'],
      })),
      note: (data?.length ?? 0) >= 200 ? 'Showing the 200 newest partners.' : 'Partner type is not recorded yet.',
    };
  },
  async act(ctx, actionId, rowId): Promise<ActionResult> {
    if (!['approve', 'suspend', 'reject'].includes(actionId)) return { ok: false, error: 'Unknown action.' };
    const { data: p } = await supabaseAdmin.from('partners').select('id, name, status, subdomain, owner_id').eq('id', rowId).maybeSingle();
    if (!p) return { ok: false, error: 'That partner no longer exists.' };
    const now = new Date().toISOString();

    if (actionId === 'reject') {
      return { ok: false, error: 'Rejecting is not available yet: the partners table has no rejected status. Suspend the partner instead.' };
    }
    if (actionId === 'suspend') {
      if (p.status !== 'active') return { ok: false, error: 'Only an active partner can be suspended.' };
      const { error } = await supabaseAdmin.from('partners').update({ status: 'suspended', updated_at: now }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not update this partner.' };
      await emailOwner(p.owner_id, p, 'suspend');
      return { ok: true, message: `${p.name} is suspended.` };
    }

    if (p.status === 'active') return { ok: false, error: 'This partner is already active.' };
    if (p.status === 'suspended') {
      // Same as the page's reinstate: no email, no new subscription.
      const { error } = await supabaseAdmin.from('partners').update({ status: 'active', updated_at: now }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not update this partner.' };
      return { ok: true, message: `${p.name} is active again.` };
    }
    if (p.status !== 'pending') return { ok: false, error: 'Only a pending or suspended partner can be approved.' };
    const tier = 'starter';
    const { error } = await supabaseAdmin.from('partners')
      .update({ status: 'active', plan_tier: tier, revenue_share_percent: 65, onboarded_at: now, updated_at: now }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this partner.' };
    await supabaseAdmin.from('partner_subscriptions').insert({
      partner_id: rowId, plan_tier: tier, billing_cycle: 'monthly', amount_ngn: TIER_AMOUNT[tier], status: 'active',
      current_period_start: now, current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    await emailOwner(p.owner_id, p, 'approve');
    return { ok: true, message: `${p.name} is approved.` };
  },
};

export default screen;
