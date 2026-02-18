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
  const [subCount, setSubCount] = useState(0);
  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [historyRes, countRes] = await Promise.all([
      supabase.from('sent_newsletters').select('*').order('sent_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setHistory(historyRes.data || []);
    setSubCount(countRes.count || 0);
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
          subject,
          content,
          sent_by: 'admin',
          subscriber_count: subCount,
          status: 'sent',
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

  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          Newsletter
        </h1>
        <span className="text-xs px-3 py-1 rounded-full"
          style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {subCount} subscribers
        </span>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        {history.length} newsletters sent
      </p>

      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
        {(['compose', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-md text-xs font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            {t === 'compose' ? '✏️ Compose' : `📋 History (${history.length})`}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>
                Subject Line
              </label>
              <input
                className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. This Week in Leadership: 3 Frameworks for Difficult Conversations"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>
                Email Content (HTML supported)
              </label>
              <textarea
                className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none font-mono"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"Write your newsletter here...\n\nUse <b>bold</b>, <i>italic</i>, <a href='...'>links</a>"}
                rows={10}
              />
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !content.trim()}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {sending ? 'Sending...' : `📨 Send to ${subCount} Subscribers`}
              </button>
            </div>
          </div>

          {result && (
            <div className="rounded-xl p-4 mt-4"
              style={{
                background: result.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
              {result.success ? (
                <p className="text-sm" style={{ color: 'var(--success)' }}>
                  ✅ Newsletter queued — Job ID: {result.runId}
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--error)' }}>
                  ❌ Failed: {result.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.subject}</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                    Sent to {item.subscriber_count} subscribers · {new Date(item.sent_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: item.status === 'sent' ? 'rgba(16,185,129,0.09)' : 'rgba(245,158,11,0.09)',
                    color: item.status === 'sent' ? 'var(--success)' : 'var(--accent)',
                  }}>
                  {item.status}
                </span>
              </div>
              <details>
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  View content
                </summary>
                <div className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap"
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