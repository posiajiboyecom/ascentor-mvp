import { requireArea } from '@/lib/admin/access';
import { getSettings, asBool } from '@/lib/admin/settings';
import { TRIAL_DAYS, GRACE_DAYS } from '@/lib/billing/rules';
import { getPlanPricing } from '@/lib/plans-config';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { naira } from '@/lib/admin/revenue-util';
import PlansScreen from '@/components/admin/console/PlansScreen';
import { PLANS, tierLabel, formatNaira, formatMoney, perMonthKobo, priceFor } from '@/lib/billing/catalog';
import { priceTypeLabel, cycleLabel } from '@/lib/admin/billing-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plans and pricing' };

const WHO: Record<string, string> = {
  explorer: 'For members finding their direction.',
  builder: 'For members building a career or business. Any member can choose it.',
};

export default async function PlansPage() {
  const staff = await requireArea('plans', 'view');
  const s = await getSettings();

  const pricing = getPlanPricing();
  const price = (id: string) => pricing.find((p) => p.id === id)?.monthlyPrice;

  const countFor = async (plan: string) => {
    const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_plan', plan);
    return count ?? 0;
  };
  const [seeker, builder] = await Promise.all([countFor('explorer'), countFor('builder')]);

  const plans = [
    { key: 'seeker' as const, name: 'Seeker', members: seeker, who: WHO.explorer, price: price('explorer') != null ? `${naira(price('explorer'))} in Nigeria · ${formatMoney(priceFor('explorer', 'solo', 'monthly', 'USD'), 'USD')} elsewhere` : '\-', open: asBool(s['plan.seeker.open']) },
    { key: 'builder' as const, name: 'Builder', members: builder, who: WHO.builder, price: price('builder') != null ? `${naira(price('builder'))} in Nigeria · ${formatMoney(priceFor('builder', 'solo', 'monthly', 'USD'), 'USD')} elsewhere` : '\-', open: asBool(s['plan.builder.open']) },
  ];

  const catalog = PLANS.map((p) => ({
    code: p.code, tier: tierLabel(p.tier), priceType: priceTypeLabel(p.priceType), cycle: cycleLabel(p.cycle),
    price: `${formatNaira(p.amountKobo)} · ${formatMoney(p.amountUsdCents, 'USD')}`,
    perMonth: p.cycle === 'yearly' ? `${formatNaira(perMonthKobo(p))} · ${formatMoney(perMonthKobo(p, 'USD'), 'USD')}` : '-',
  }));

  return (
    <PlansScreen
      catalog={catalog}
      canEdit={staff.uiLevel('plans') !== 'view' && staff.uiLevel('plans') !== 'none'}
      plans={plans}
      trialDays={TRIAL_DAYS}
      graceDays={GRACE_DAYS}
    />
  );
}
