'use client';

import { useRef, useState, useTransition, useEffect } from 'react';
import { Check } from 'lucide-react';
import { savePlans, type PlansInput } from '@/app/admin/c/plans/actions';
import '@/styles/admin-console.css';

interface PlanCard { key: 'seeker' | 'builder' | 'pinnacle'; name: string; members: number; who: string; price: string; open: boolean }
function Toggle({ on, locked, label, onClick }: { on: boolean; locked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`toggle${on ? ' on' : ''}${locked ? ' lock' : ''}`} aria-pressed={on} aria-label={label} aria-disabled={locked || undefined} onClick={() => { if (!locked) onClick(); }} />
  );
}

interface CatalogRow { code: string; tier: string; priceType: string; cycle: string; price: string; perMonth: string }

export default function PlansScreen({ canEdit, plans, catalog, trialDays, graceDays }: {
  canEdit: boolean; plans: PlanCard[]; catalog: CatalogRow[]; trialDays: number; graceDays: number;
}) {
  const [open, setOpen] = useState<PlansInput['open']>({ seeker: plans[0].open, builder: plans[1].open, pinnacle: plans[2]?.open ?? true });
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };

  const save = () => {
    if (!canEdit) { flash('Your role can view this but not change it.'); return; }
    setError('');
    start(async () => {
      const res = await savePlans({ open });
      if (!res.ok) { setError(res.error); return; }
      flash(res.message);
    });
  };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Revenue</p><h1 className="pt">Plans and pricing</h1><span className="ul" /></div>
          <button type="button" className="btn bp" disabled={pending || !canEdit} onClick={save}>Save changes</button>
        </div>
        <p className="p" style={{ maxWidth: 760 }}>Ascentor’s three plans, Seeker, Builder and Pinnacle: who can sign up, every price, and how trials and failed payments work.</p>

        {!canEdit && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        {error && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>{error}</p></div>}

        <div className="g2">
          {plans.map((p) => (
            <div key={p.key} className="card plan">
              <div className="sb"><p className="h2">{p.name}</p><span className="tag"><i />{p.members.toLocaleString('en-NG')} members</span></div>
              <p className="sm p">{p.who}</p>
              <div className="fld">
                <label>Monthly price (solo)</label>
                <input className="in" value={p.price} readOnly aria-label={`${p.name} monthly price`} />
                <p className="sm p">From the catalog below. Group and yearly prices are listed there too.</p>
              </div>
              <div className="setrow">
                <span>Open for sign-ups</span>
                <Toggle on={open[p.key]} locked={!canEdit} label={`${p.name}: open for sign-ups`} onClick={() => setOpen((o) => ({ ...o, [p.key]: !o[p.key] }))} />
              </div>
            </div>
          ))}
        </div>

        <div className="card st8">
          <p className="h3">Price catalog</p>
          <p className="sm p">Every price members can be charged: naira for members in Nigeria, US dollars for everyone else (decided by location; there is no group discount in US dollars). Read-only here: prices are set in code (lib/billing/catalog.ts) and change with a release.</p>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr>{['Plan', 'Tier', 'Price type', 'Billing', 'Price', 'Per month'].map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>
                {catalog.map((c) => (
                  <tr key={c.code}>
                    <td><span className="num">{c.code}</span></td>
                    <td>{c.tier}</td><td>{c.priceType}</td><td>{c.cycle}</td>
                    <td><span className="num">{c.price}</span></td><td>{c.perMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="g2">
          <div className="card st8">
            <p className="h3">Free trial and renewals</p>
            <p className="sm p">Every plan starts with {trialDays} days free. The member adds a card, is charged on day {trialDays + 1}, and can cancel before then to pay nothing. Plans renew by card each month or year.</p>
          </div>
          <div className="card st8">
            <p className="h3">If a payment fails</p>
            <p className="sm p">The member keeps full access for {graceDays} days while we retry the card (1, 3 and 5 days after the first failure). After that they move to light access until they pay.</p>
            <p className="sm p">Light access keeps Today, their growth record, the Open house group and direct messages. Sage, Circle chat, mentor sessions and Learn pause.</p>
          </div>
        </div>
        <p className="sm p">These rules are fixed in Billing v2 (lib/billing/rules.ts and lib/billing/access.ts) and change with a release.</p>
      </div>
      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
