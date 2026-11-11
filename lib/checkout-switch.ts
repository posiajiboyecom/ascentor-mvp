// lib/checkout-switch.ts
// Server-only. The admin "Checkout" switch (platform_settings.checkout_enabled; admin overview). When it is off,
// checkout shows "Paid plans aren't open yet" and Billing does not offer a trial. FREE_MODE=true forces it off
// (local development). Fails open: if the setting cannot be read, checkout stays on so a paying member is never blocked.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function isCheckoutOn(): Promise<boolean> {
  if (process.env.FREE_MODE === 'true') return false;
  try {
    const { data } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'checkout_enabled').maybeSingle();
    return !(data && (data as { value: string }).value === 'false');
  } catch {
    return true;
  }
}
