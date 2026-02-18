'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminNewsletterPage() {
  const supabase = createClient();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [tab, setTab] = useState<'compose' | 'history' | 'subscribers'>('compose');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [historyRes, subsRes] = await Promise.all([
      supabase.from('sent_newsletters').select('*').order('sent_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false }),
    ]);
    setHistory(historyRes.data || []);
    setSubscribers(subsRes.data || []);
    setSubCount((subsRes.data || []).filter((s: any) => s.is_active).length);
  }

  async function handleSend() {
    if (!subject.trim() || !content.trim()) return;
    if (!confirm(`Send this newsletter to ${subCount} active subscribers?`)) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content }),
      });
      const data = await res.json();

      if (res.ok) {
        await supabase.from('sent_newsletters').insert({
          subject, content, sent_by: 'admin',
          subscriber_count: subCount, status: 'sent',
          trigger_run_id: data.runId || null,
        });
        setResult({ success: true, runId: data.runId });
        setSubject('');
        setContent('');
        loadData();
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    }
    setSending(false);
  }

  async function toggleSubscriber(id: string, isActive: boolean) {
    await supabase.from('newsletter_subscribers').update({ is_active: !isActive }).eq('id', id);
    loadData();
  }

  async function deleteSubscriber(id: string, email: string) {
    if (!confirm(`Remove ${email} from subscribers?`)) return;
    await supabase.from('newsletter_subscribers').delete().eq('id', id);
    loadData();
  }

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
        <h1 className="text-xl md:text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          Newsletter
        </h1>
        <span className="text-xs px-3 py-1 rounded-full"
          style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {subCount} active subscribers
        </span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {history.length} sent · {subscribers.length} total subscribers
      </p>

      <div className="flex gap-1 mb-5 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {(['compose', 'subscribers', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap px-2"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            {t === 'compose' ? '✏️ Compose' : t === 'subscribers' ? `👥 Subs (${subscribers.length})` : `📋 History (${history.length})`}
          </button>
        ))}
      </div>

      {/* COMPOSE TAB */}
      {tab === 'compose' && (
        <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Subject Line</label>
              <input className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. This Week in Leadership" />
            </div>
            <div>
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Email Content (HTML supported)</label>
              <textarea className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={content} onChange={(e) => setContent(e.target.value)}
                placeholder={"Write your newsletter here...\n\nUse <b>bold</b>, <i>italic</i>, <a href='...'>links</a>"}
                rows={8} />
            </div>
            <button onClick={handleSend}
              disabled={sending || !subject.trim() || !content.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 self-start"
              style={{ background: 'var(--accent)', color: '#000' }}>
              {sending ? 'Sending...' : `📨 Send to ${subCount} Subscribers`}
            </button>
          </div>
          {result && (
            <div className="rounded-xl p-3 mt-4" style={{
              background: result.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <p className="text-xs" style={{ color: result.success ? 'var(--success)' : 'var(--error)' }}>
                {result.success ? `✅ Queued — ${result.runId}` : `❌ ${result.error}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBSCRIBERS TAB */}
      {tab === 'subscribers' && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
              style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              <div className="col-span-4">Email</div>
              <div className="col-span-2">Name</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Subscribed</div>
              <div className="col-span-2 text-center">Actions</div>
            </div>
            {subscribers.map((sub) => (
              <div key={sub.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                style={{ borderBottom: '1px solid var(--border)', opacity: sub.is_active ? 1 : 0.5 }}>
                <div className="col-span-4"><p className="text-sm truncate" style={{ color: 'var(--text)' }}>{sub.email}</p></div>
                <div className="col-span-2"><p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{sub.first_name || '—'}</p></div>
                <div className="col-span-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>{sub.source || 'website'}</span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {new Date(sub.subscribed_at || sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="col-span-2 flex gap-1 justify-center">
                  <button onClick={() => toggleSubscriber(sub.id, sub.is_active)}
                    className="text-[10px] px-2 py-1 rounded-lg"
                    style={{ color: sub.is_active ? 'var(--text-dim)' : 'var(--success)', border: '1px solid var(--border)' }}>
                    {sub.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deleteSubscriber(sub.id, sub.email)}
                    className="text-[10px] px-2 py-1 rounded-lg"
                    style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {subscribers.map((sub) => (
              <div key={sub.id} className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: sub.is_active ? 1 : 0.5 }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{sub.email}</p>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      {sub.first_name || 'No name'} · {sub.source || 'website'} · {new Date(sub.subscribed_at || sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2"
                    style={{ background: sub.is_active ? 'rgba(16,185,129,0.09)' : 'rgba(107,114,128,0.09)', color: sub.is_active ? 'var(--success)' : 'var(--text-dim)' }}>
                    {sub.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleSubscriber(sub.id, sub.is_active)}
                    className="text-[11px] px-3 py-1 rounded-lg"
                    style={{ color: sub.is_active ? 'var(--text-dim)' : 'var(--success)', border: '1px solid var(--border)' }}>
                    {sub.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deleteSubscriber(sub.id, sub.email)}
                    className="text-[11px] px-3 py-1 rounded-lg"
                    style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {subscribers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No subscribers yet</p>
            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          {history.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No newsletters sent yet</p>
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.subject}</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                    {item.subscriber_count} subscribers · {new Date(item.sent_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>
                  {item.status}
                </span>
              </div>
              <details>
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>View content</summary>
                <div className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap break-words"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  {item.content}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
