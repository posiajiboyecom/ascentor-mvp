import { requireArea } from '@/lib/admin/access';
import { getSettings, asBool, asInt } from '@/lib/admin/settings';
import { getPlanPricing } from '@/lib/plans-config';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { naira } from '@/lib/admin/revenue-util';
import PlansScreen from '@/components/admin/console/PlansScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plans and pricing' };

const WHO: Record<string, string> = {
  explorer: 'For members finding their direction.',
  builder: 'For members building a career or business. Any member can choose it.',
  leader: 'For members who facilitate a Circle. Leader is a paid plan.',
};

export default async function PlansPage() {
  const staff = await requireArea('plans', 'view');
  const s = await getSettings();

  let pricing: ReturnType<typeof getPlanPricing> = [];
  let priceError = false;
  try { pricing = getPlanPricing(); } catch { priceError = true; }
  const price = (id: string) => pricing.find((p) => p.id === id)?.monthlyPrice;

  const countFor = async (plan: string) => {
    const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_plan', plan);
    return count ?? 0;
  };
  const [seeker, builder, leader] = await Promise.all([countFor('explorer'), countFor('builder'), countFor('leader')]);

  const plans = [
    { key: 'seeker' as const, name: 'Seeker', members: seeker, who: WHO.explorer, price: price('explorer') != null ? naira(price('explorer')) : '\-', open: asBool(s['plan.seeker.open']) },
    { key: 'builder' as const, name: 'Builder', members: builder, who: WHO.builder, price: price('builder') != null ? naira(price('builder')) : '\-', open: asBool(s['plan.builder.open']) },
    { key: 'leader' as const, name: 'Leader', members: leader, who: WHO.leader, price: price('leader') != null ? naira(price('leader')) : '\-', open: asBool(s['plan.leader.open']) },
  ];

  return (
    <PlansScreen
      canEdit={staff.uiLevel('plans') !== 'view' && staff.uiLevel('plans') !== 'none'}
      priceError={priceError}
      plans={plans}
      extraDays={asInt(s['billing.extra_days'], 7, 0, 60)}
      graceDays={asInt(s['billing.grace_days'], 7, 0, 60)}
      light={{
        today: asBool(s['light.today']), chat: asBool(s['light.chat']), sage: asBool(s['light.sage']),
        learn: asBool(s['light.learn']), mentor: asBool(s['light.mentor']), groups: asBool(s['light.groups']),
      }}
    />
  );
}
