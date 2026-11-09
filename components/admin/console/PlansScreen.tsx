'use client';

import { useRef, useState, useTransition, useEffect } from 'react';
import { Check } from 'lucide-react';
import { savePlans, type PlansInput } from '@/app/admin/c/plans/actions';
import '@/styles/admin-console.css';

interface PlanCard { key: 'seeker' | 'builder' | 'leader'; name: string; members: number; who: string; price: string; open: boolean }
type Light = PlansInput['light'];

const LIGHT_ROWS: [keyof Light, string][] = [
  ['today', 'Today and check-ins'], ['chat', 'Circle chat'], ['sage', 'Sage · AI assistant'],
  ['learn', 'Learn pathways'], ['mentor', 'Mentor sessions'], ['groups', 'Joining new groups'],
];

function Toggle({ on, locked, label, onClick }: { on: boolean; locked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`toggle${on ? ' on' : ''}${locked ? ' lock' : ''}`} aria-pressed={on} aria-label={label} aria-disabled={locked || undefined} onClick={() => { if (!locked) onClick(); }} />
  );
}

interface CatalogRow { code: string; tier: string; priceType: string; cycle: string; price: string; perMonth: string }

export default function PlansScreen({ canEdit, priceError, plans, extraDays, graceDays, light, catalog, v2On }: {
  canEdit: boolean; priceError: boolean; plans: PlanCard[]; extraDays: number; graceDays: number; light: Light; catalog: CatalogRow[]; v2On: boolean;
}) {
  const [open, setOpen] = useState<PlansInput['open']>({ seeker: plans[0].open, builder: plans[1].open, leader: plans[2].open });
  const [extra, setExtra] = useState(String(extraDays));
  const [grace, setGrace] = useState(String(graceDays));
  const [lt, setLt] = useState<Light>(light);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };

  const save = () => {
    if (!canEdit) { flash('Your role can view this but not change it.'); return; }
    const e = Number(extra), g = Number(grace);
    if (!/^\d+$/.test(extra.trim()) || e > 60) { setError('Extra days must be a whole number from 0 to 60.'); return; }
    if (!/^\d+$/.test(grace.trim()) || g > 60) { setError('The grace period must be a whole number of days from 0 to 60.'); return; }
    setError('');
    start(async () => {
      const res = await savePlans({ open, extraDays: e, graceDays: g, light: lt });
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
        <p className="p" style={{ maxWidth: 760 }}>Who can sign up, the extra days on a first payment and what lapsed members keep.</p>

        {!canEdit && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        {priceError && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>A plan price setting in Vercel is not a valid whole number of naira, so prices are not shown. Fix it in Vercel and redeploy.</p></div>}
        {error && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>{error}</p></div>}

        <div className="g3">
          {plans.map((p) => (
            <div key={p.key} className="card plan">
              <div className="sb"><p className="h2">{p.name}</p><span className="tag"><i />{p.members.toLocaleString('en-NG')} members</span></div>
              <p className="sm p">{p.who}</p>
              <div className="fld">
                <label>Monthly price</label>
                <input className="in" value={p.price} readOnly aria-label={`${p.name} monthly price`} />
                <p className="sm p">Prices are set in Vercel (PLAN_SEEKER_PRICE_NGN, PLAN_BUILDER_PRICE_NGN, PLAN_LEADER_PRICE_NGN) and need a redeploy to change.</p>
              </div>
              <div className="setrow">
                <span>Open for sign-ups</span>
                <Toggle on={open[p.key]} locked={!canEdit} label={`${p.name}: open for sign-ups`} onClick={() => setOpen((o) => ({ ...o, [p.key]: !o[p.key] }))} />
              </div>
            </div>
          ))}
        </div>

        <div className="card st8">
          <div className="sb"><p className="h3">Billing v2 catalog</p><span className={`tag ${v2On ? 'good' : 'warn'}`}><i />{v2On ? 'Billing v2 is on' : 'Billing v2 is off'}</span></div>
          <p className="sm p">{v2On ? 'Members see these prices at checkout.' : 'Billing v2 is off, so members still see the plans above. These are the prices that apply once it is switched on.'} Prices are read-only here: they are set in code (lib/billing/catalog.ts) from the payments handoff, and change with a release.</p>
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
          <div className="card">
            <p className="h3" style={{ marginBottom: 6 }}>Billing</p>
            <div className="setrow">
              <span>Extra days on the first payment</span>
              <input className="in" inputMode="numeric" value={extra} readOnly={!canEdit} onChange={(e) => setExtra(e.target.value)} aria-label="Extra days on the first payment" />
            </div>
            <p className="sm p">Members pay now and get these extra days on top of their first paid period. There is no free trial.</p>
          </div>
          <div className="card">
            <p className="h3" style={{ marginBottom: 6 }}>Light access after a failed payment</p>
            <div className="setrow">
              <span>Grace period before light access (days)</span>
              <input className="in" inputMode="numeric" value={grace} readOnly={!canEdit} onChange={(e) => setGrace(e.target.value)} aria-label="Grace period days" />
            </div>
            {LIGHT_ROWS.map(([k, label]) => (
              <div key={k} className="setrow">
                <span>Keep: {label}</span>
                <Toggle on={lt[k]} locked={!canEdit} label={`Keep: ${label}`} onClick={() => setLt((l) => ({ ...l, [k]: !l[k] }))} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
