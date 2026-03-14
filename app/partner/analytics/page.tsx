'use client';
// app/partner/analytics/page.tsx
//
// Partner engagement analytics — the coaching outcomes dashboard.
// Shows what a serious coach actually cares about:
//   - Are my members using the platform? (session frequency)
//   - Are they completing courses? (completion rate)
//   - Is my community growing? (member growth week-over-week)
//   - What content is landing? (per-course stats)
//
// Data comes from GET /api/partner/analytics — already fully built.
// This page is the missing UI for that API.

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useApiBase } from '@/lib/useApiBase';

interface OverviewStats {
  totalMembers:    number;
  activeMembers:   number;
  newThisMonth:    number;
  totalEnrollments: number;
  totalCompletions: number;
  completionRate:  number;
  totalSessions:   number;
  totalRevenue:    number;
}

interface RevenueTrendItem { month: string; amount: number; }
interface MemberGrowthItem { week: string;  count:  number; }
interface CourseStatItem {
  id:          string;
  title:       string;
  enrollments: number;
  completions: number;
  rate:        number;
}

interface AnalyticsData {
  overview:     OverviewStats;
  revenueTrend: RevenueTrendItem[];
  memberGrowth: MemberGrowthItem[];
  courseStats:  CourseStatItem[];
}

const C = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '20px',
  } as React.CSSProperties,
  label: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: '6px',
  } as React.CSSProperties,
  value: {
    fontSize: '28px',
    fontWeight: 500,
    color: '#f8fafc',
    lineHeight: 1.1,
  } as React.CSSProperties,
  sub: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '4px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f8fafc',
    marginBottom: '14px',
    marginTop: '28px',
  } as React.CSSProperties,
};

function BarChart({
  data, valueKey, labelKey, color = '#E8A020', maxHeight = 80,
}: {
  data: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  maxHeight?: number;
}) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: maxHeight + 24 }}>
      {data.map((d, i) => {
        const h = Math.round((d[valueKey] / max) * maxHeight);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
              {d[valueKey] > 0 ? d[valueKey] : ''}
            </div>
            <div style={{
              width: '100%', height: Math.max(h, 2),
              background: h > 0 ? color : 'rgba(255,255,255,0.06)',
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.4s ease',
            }} />
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
              {d[labelKey]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{ ...C.card, flex: 1 }}>
      <div style={C.label}>{label}</div>
      <div style={{ ...C.value, color: accent ? '#E8A020' : '#f8fafc' }}>{value}</div>
      {sub && <div style={C.sub}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = '#E8A020' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: '4px', transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

export default function PartnerAnalyticsPage() {
  const apiBase = useApiBase();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setError('');
    setLoading(true);
    fetch(`${apiBase}/api/partner/analytics`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [apiBase]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ ...C.card, height: '80px', background: 'rgba(255,255,255,0.02)' }} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...C.card, color: '#EF4444', fontSize: '13px' }}>
        {error || 'No data available.'}
      </div>
    );
  }

  const { overview, revenueTrend, memberGrowth, courseStats } = data;
  const activePct = overview.totalMembers > 0
    ? Math.round((overview.activeMembers / overview.totalMembers) * 100)
    : 0;

  const maxRevenue = Math.max(...revenueTrend.map(r => r.amount), 1);

  return (
    <div style={{ maxWidth: '820px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>Analytics</h1>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
        Coaching outcomes and member engagement for your platform.
      </p>

      {/* ── Row 1: Key numbers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Total members" value={overview.totalMembers}
          sub={`${overview.newThisMonth} joined this month`} />
        <StatCard label="Active members" value={`${activePct}%`}
          sub={`${overview.activeMembers} of ${overview.totalMembers}`} accent />
        <StatCard label="Coaching sessions" value={overview.totalSessions}
          sub="last 90 days" />
        <StatCard label="Course completions" value={`${overview.completionRate}%`}
          sub={`${overview.totalCompletions} of ${overview.totalEnrollments} enrolled`} />
      </div>

      {/* ── Row 2: Member engagement detail ── */}
      <p style={C.sectionTitle}>Member engagement</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Sessions per active member */}
        <div style={C.card}>
          <div style={C.label}>Avg sessions per active member</div>
          <div style={{ ...C.value, fontSize: '36px', color: '#E8A020' }}>
            {overview.activeMembers > 0
              ? (overview.totalSessions / overview.activeMembers).toFixed(1)
              : '—'}
          </div>
          <div style={C.sub}>coaching sessions ÷ active members (90 days)</div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Engagement rate</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{activePct}%</span>
            </div>
            <ProgressBar value={overview.activeMembers} max={overview.totalMembers} />
          </div>
        </div>

        {/* Member growth (weekly) */}
        <div style={C.card}>
          <div style={C.label}>New members — last 4 weeks</div>
          <BarChart data={memberGrowth} valueKey="count" labelKey="week" color="#E8A020" maxHeight={70} />
        </div>
      </div>

      {/* ── Row 3: Course completion breakdown ── */}
      {courseStats.length > 0 && (
        <>
          <p style={C.sectionTitle}>Course performance</p>
          <div style={C.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: '8px',
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.3)', paddingBottom: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '10px' }}>
              <div>Course</div>
              <div style={{ textAlign: 'right' }}>Enrolled</div>
              <div style={{ textAlign: 'right' }}>Completed</div>
              <div>Completion</div>
            </div>
            {courseStats.map((c) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px',
                gap: '8px', alignItems: 'center', padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: '13px', color: '#f8fafc' }}>{c.title}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{c.enrollments}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{c.completions}</div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: c.rate >= 50 ? '#10B981' : 'rgba(255,255,255,0.4)' }}>
                      {c.rate}%
                    </span>
                  </div>
                  <ProgressBar
                    value={c.completions} max={c.enrollments}
                    color={c.rate >= 50 ? '#10B981' : '#E8A020'}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {courseStats.length === 0 && (
        <>
          <p style={C.sectionTitle}>Course performance</p>
          <div style={{ ...C.card, textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
            No published courses yet. Add courses in the Courses section to track completions here.
          </div>
        </>
      )}

      {/* ── Row 4: Revenue trend ── */}
      <p style={C.sectionTitle}>Revenue trend — your share (last 6 months)</p>
      <div style={C.card}>
        {revenueTrend.every(r => r.amount === 0) ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
            No revenue recorded yet. Revenue will appear here once members start subscribing.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={C.label}>Total (6 months)</div>
                <div style={{ fontSize: '22px', fontWeight: 500, color: '#10B981' }}>
                  ₦{overview.totalRevenue.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={C.label}>Best month</div>
                <div style={{ fontSize: '22px', fontWeight: 500, color: '#f8fafc' }}>
                  ₦{Math.max(...revenueTrend.map(r => r.amount)).toLocaleString()}
                </div>
              </div>
            </div>
            <BarChart data={revenueTrend} valueKey="amount" labelKey="month" color="#10B981" maxHeight={80} />
          </>
        )}
      </div>

      {/* ── Health score ── */}
      <p style={C.sectionTitle}>Platform health</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          {
            label: 'Member activation',
            value: activePct,
            target: 70,
            hint: '% of members who are active',
            good: activePct >= 70,
          },
          {
            label: 'Course completion',
            value: overview.completionRate,
            target: 50,
            hint: '% of enrolled who completed',
            good: overview.completionRate >= 50,
          },
          {
            label: 'Session frequency',
            value: overview.activeMembers > 0
              ? Math.round(overview.totalSessions / overview.activeMembers)
              : 0,
            target: 5,
            hint: 'sessions per active member (90d)',
            good: overview.activeMembers > 0 && (overview.totalSessions / overview.activeMembers) >= 5,
          },
        ].map(({ label, value, target, hint, good }) => (
          <div key={label} style={{
            ...C.card,
            borderColor: good ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={C.label}>{label}</div>
              <div style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '20px', fontWeight: 700,
                background: good ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                color: good ? '#10B981' : 'rgba(255,255,255,0.35)',
                border: `1px solid ${good ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                {good ? 'On track' : `Target: ${target}${label === 'Session frequency' ? '' : '%'}`}
              </div>
            </div>
            <div style={{ ...C.value, fontSize: '30px', color: good ? '#10B981' : '#f8fafc' }}>
              {value}{label !== 'Session frequency' ? '%' : ''}
            </div>
            <div style={C.sub}>{hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
