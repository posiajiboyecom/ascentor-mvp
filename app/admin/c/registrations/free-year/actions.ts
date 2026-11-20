'use server';

// Summit free year: add emails to the approved list, or remove one. Needs Edit on Registrations.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Res = { ok: boolean; error?: string; message?: string };
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Adds every email found in the text (one per line, or separated by commas). Already-listed emails are left as they are. */
export async function addFreeYearEmails(text: string, note: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const emails = [...new Set(String(text ?? '').toLowerCase().split(/[\s,;<>]+/).filter((e) => EMAIL_RE.test(e)))].slice(0, 500);
    if (!emails.length) return { ok: false, error: 'No email addresses found.' };
    const rows = emails.map((email) => ({ email, source: 'admin', note: String(note ?? '').trim().slice(0, 200) || null, added_by: staff.userId }));
    const { data, error } = await supabaseAdmin.from('summit_access_grants').upsert(rows, { onConflict: 'email', ignoreDuplicates: true }).select('email');
    if (error) throw error;
    // A removed email that is added again is put back on the list.
    await supabaseAdmin.from('summit_access_grants').update({ revoked_at: null }).in('email', emails).is('claimed_user_id', null);
    await auditAdmin(staff, `Added ${emails.length} email(s) to the Summit free year list`, 'summit_access_grants', 'Registrations');
    revalidatePath('/admin/c/registrations/free-year');
    const added = data?.length ?? 0;
    return { ok: true, message: `${added} added${emails.length - added ? `, ${emails.length - added} already on the list` : ''}.` };
  } catch (e) { return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work.' }; }
}

/** Removes an unclaimed email from the list. A claimed free year is not taken away here. */
export async function removeFreeYearEmail(email: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const { data, error } = await supabaseAdmin.from('summit_access_grants').update({ revoked_at: new Date().toISOString() })
      .eq('email', String(email).toLowerCase()).is('claimed_user_id', null).select('email');
    if (error) throw error;
    if (!data?.length) return { ok: false, error: 'Only unclaimed emails can be removed.' };
    await auditAdmin(staff, 'Removed an email from the Summit free year list', 'summit_access_grants', 'Registrations');
    revalidatePath('/admin/c/registrations/free-year');
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work.' }; }
}
