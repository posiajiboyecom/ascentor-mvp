// components/pricing/RevenueModel.tsx
import { REVENUE_ROWS } from '../data'

export default function RevenueModel() {
  return (
    <div className="space-y-8">
      {/* B2C */}
      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          B2C revenue scenarios (USD)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scenario</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Free</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Builder</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pro</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Elite</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { scenario: 'Early (month 6)',  free: '500',   builder: '40 × $19',  pro: '15 × $39',  elite: '3 × $99',   mrr: '$1,618' },
                { scenario: 'Growth (month 12)', free: '2,000', builder: '150 × $19', pro: '60 × $39',  elite: '15 × $99',  mrr: '$6,675' },
                { scenario: 'Scale (month 24)',  free: '8,000', builder: '500 × $19', pro: '200 × $39', elite: '50 × $99',  mrr: '$22,250' },
              ].map((row) => (
                <tr key={row.scenario} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{row.scenario}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.free}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.builder}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.pro}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.elite}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{row.mrr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* B2B */}
      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          B2B revenue scenarios (USD)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Scenario', 'Partners', 'Avg flat fee', 'Avg seats', 'Seat $', 'MRR'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { scenario: 'Early (month 6)',   partners: '3',  flat: '$299', seats: '80 avg',  seat: '$4/seat',   mrr: '$1,617' },
                { scenario: 'Growth (month 12)', partners: '10', flat: '$499', seats: '200 avg', seat: '$3/seat',   mrr: '$10,990' },
                { scenario: 'Scale (month 24)',  partners: '25', flat: '$799', seats: '350 avg', seat: '$2.5/seat', mrr: '$41,725' },
              ].map((row) => (
                <tr key={row.scenario} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{row.scenario}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.partners}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.flat}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.seats}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.seat}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{row.mrr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Combined */}
      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Combined trajectory
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['Month', 'B2C MRR', 'B2B MRR', 'Total MRR', 'ARR'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {REVENUE_ROWS.map((row) => (
                <tr key={row.label} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.b2cMRR}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.b2bMRR}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.totalMRR}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{row.arr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          B2B becomes your dominant revenue stream by month 10. Prioritise partner acquisition early — one Academy partner at scale equals 73 Builder B2C users.
        </p>
      </section>
    </div>
  )
}
