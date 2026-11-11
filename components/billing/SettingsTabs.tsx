// The one Settings tab row, used by /settings and /settings/billing so Settings is a single screen.
// "Billing" lives at its own URL (/settings/billing); the others are ?tab= on /settings.
import Link from 'next/link';

export const SETTINGS_TABS = [['account', 'Account'], ['profile', 'Profile'], ['security', 'Security'], ['billing', 'Billing'], ['alerts', 'Alerts']] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number][0];

export default function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <div className="rx-opts rx-tabs" role="tablist" aria-label="Settings">
      {SETTINGS_TABS.map(([k, label]) => (
        <Link key={k} href={k === 'billing' ? '/settings/billing' : `/settings?tab=${k}`} scroll={false} role="tab" aria-selected={active === k} className={`rx-opt${active === k ? ' on' : ''}`}>{label}</Link>
      ))}
    </div>
  );
}
