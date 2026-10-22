// The Settings tab row, shared by the billing sub-pages so they sit in the same place as the rest of Settings.
// "Plan" points at /settings/billing (billing v2).
import Link from 'next/link';

const TABS = [['account', 'Account'], ['profile', 'Profile'], ['security', 'Security'], ['plan', 'Plan'], ['alerts', 'Alerts']] as const;

export default function SettingsTabs({ active }: { active: (typeof TABS)[number][0] }) {
  return (
    <div className="rx-opts rx-tabs" role="tablist" aria-label="Settings">
      {TABS.map(([k, label]) => (
        <Link key={k} href={k === 'plan' ? '/settings/billing' : `/settings?tab=${k}`} role="tab" aria-selected={active === k} className={`rx-opt${active === k ? ' on' : ''}`}>{label}</Link>
      ))}
    </div>
  );
}
