// Overview, built to the admin prototype. Draws data prepared on the server (lib/admin/overview.ts); nothing here fetches.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { OverviewData } from '@/lib/admin/overview';

const link: CSSProperties = { textDecoration: 'none', color: 'inherit' };

export default function OverviewScreen({ data }: { data: OverviewData }) {
  const peak = Math.max(1, ...data.weeks.map((w) => w.v));
  const planPeak = Math.max(1, ...data.plans.map((p) => p.v));
  const chartLabel = `New members per week, last 8 weeks: ${data.weeks.map((w) => `${w.x} ${w.v}`).join(', ')}`;

  return (
    <div className="admc">
      <div className="pg screen">
        <div><p className="eyebrow">{data.eyebrow}</p><h1 className="pt">Overview</h1><span className="ul" /></div>
        <div className="kpis">
          {data.kpis.map((k) => (
            <div key={k.label} className="card kpi"><span className="k">{k.label}</span><span className="v">{k.value}</span><span className="sm">{k.note}</span></div>
          ))}
        </div>
        <div className="g2 g2-ov">
          <div className="card st">
            <div className="sb"><p className="h3">Needs attention</p><span className="sm">Live from the screens</span></div>
            <div>
              {data.attn.length === 0 && <p className="sm p">Nothing needs attention right now.</p>}
              {data.attn.map((a) => (
                <Link key={a.area} href={`/admin/c/${a.area}?filter=${encodeURIComponent(a.filter)}`} className="attn" style={link}>
                  <span className={`n ${a.tone}`}>{a.n.toLocaleString('en-US')}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="num" style={{ display: 'block' }}>{a.n.toLocaleString('en-US')} {a.text}</span>
                    <span className="sm">{a.hint}</span>
                  </span>
                  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </Link>
              ))}
            </div>
          </div>
          <div className="st">
            <div className="card st8">
              <p className="h3">New members per week</p><p className="sm p">Last 8 weeks. Hover a bar for its value.</p>
              <div className="chart" role="img" aria-label={chartLabel}>
                {data.weeks.map((w, i) => {
                  const h = `${Math.round((w.v / peak) * 88)}%`;
                  return (
                    <button key={w.x} type="button" tabIndex={-1} className={`bar${i === data.weeks.length - 1 ? ' last' : ''}`} style={{ ['--h' as string]: h } as CSSProperties} aria-label={`Week of ${w.x}: ${w.v} new members`}>
                      <em>{w.v}</em><span style={{ height: h }} />
                    </button>
                  );
                })}
              </div>
              <div className="xlabels" aria-hidden="true">{data.weeks.map((w) => <span key={w.x}>{w.x}</span>)}</div>
            </div>
            <div className="card st8">
              <p className="h3">Members by plan</p>
              {data.plans.map((p) => (
                <div key={p.label} className="hbar">
                  <span>{p.label}</span>
                  <span className="tr" role="img" aria-label={`${p.label}: ${p.v} members`}><span style={{ width: `${Math.round((p.v / planPeak) * 100)}%` }} /></span>
                  <span className="num" style={{ textAlign: 'right' }}>{p.v.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card st8">
          <div className="sb">
            <p className="h3">Recent admin activity</p>
            <Link href="/admin/c/audit" className="lk">Audit log<svg className="ic ics" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
          </div>
          {data.recent.length === 0 && <p className="sm p">No admin changes yet.</p>}
          {data.recent.map((r, i) => (
            <div key={i} className="sb" style={{ minHeight: 40, borderBottom: '1px solid var(--border)' }}>
              <span><b>{r.who}</b> · {r.what} · {r.item}</span>
              <span className="sm" style={{ whiteSpace: 'nowrap' }}>{r.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
