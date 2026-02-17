import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  // Fetch all stats in parallel
  const [usersRes, newUsersRes, sessionsRes, sessions7dRes, postsRes, posts7dRes, cohortsRes, eventsRes, coursesRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }),
    supabase.from('coaching_sessions').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('cohort_posts').select('id', { count: 'exact', head: true }),
    supabase.from('cohort_posts').select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('cohorts').select('id, name, member_count').order('member_count', { ascending: false }).limit(5),
    supabase.from('expert_sessions').select('*').eq('status', 'scheduled').order('scheduled_at').limit(3),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
  ]);

  const stats = [
    { label: 'Total Users', value: usersRes.count || 0, sub: `+${newUsersRes.count || 0} this week`, icon: '👥', color: 'var(--blue)', href: '/admin/users' },
    { label: 'Coaching Sessions', value: sessionsRes.count || 0, sub: `+${sessions7dRes.count || 0} this week`, icon: '💬', color: 'var(--accent)', href: '/admin/coaching' },
    { label: 'Community Posts', value: postsRes.count || 0, sub: `+${posts7dRes.count || 0} this week`, icon: '📝', color: 'var(--teal)', href: '/admin/cohorts' },
    { label: 'Published Courses', value: coursesRes.count || 0, sub: 'Active', icon: '📚', color: 'var(--purple)', href: '/admin/courses' },
  ];

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Admin Dashboard
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Overview of Ascentor platform activity
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="rounded-xl p-4 transition-all hover:border-gray-600 cursor-pointer"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${s.color}15`, color: s.color }}>
                  {s.sub}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
                {s.value.toLocaleString()}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Two columns: cohorts + upcoming events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Cohorts */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🏘️ Top Cohorts</span>
            <Link href="/admin/cohorts" className="text-xs" style={{ color: 'var(--accent)' }}>Manage →</Link>
          </div>
          {cohortsRes.data?.map((c: any) => (
            <div key={c.id} className="flex justify-between items-center py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{c.name}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                {c.member_count} members
              </span>
            </div>
          )) || (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No cohorts yet</p>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🎓 Upcoming Events</span>
            <Link href="/admin/experts" className="text-xs" style={{ color: 'var(--accent)' }}>Manage →</Link>
          </div>
          {eventsRes.data?.length ? eventsRes.data.map((e: any) => (
            <div key={e.id} className="flex justify-between items-center py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{e.title}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {e.expert_name} · {new Date(e.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>
                {e.status}
              </span>
            </div>
          )) : (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No upcoming events</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Create Cohort', href: '/admin/cohorts?action=create', icon: '➕' },
            { label: 'Add Expert Event', href: '/admin/experts?action=create', icon: '🎤' },
            { label: 'Add Course', href: '/admin/courses?action=create', icon: '📖' },
            { label: 'Manage Roles', href: '/admin/users', icon: '🔑' },
          ].map((a) => (
            <Link key={a.label} href={a.href}>
              <div className="rounded-lg p-3 text-center transition-all hover:border-gray-600 cursor-pointer"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <span className="text-xl">{a.icon}</span>
                <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>{a.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
