'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminNewsletterSendPage() {
  const supabase = createClient();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSend() {
    if (!subject.trim() || !content.trim()) return;
    if (!confirm(`Send this newsletter to ALL active subscribers?`)) return;

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
        setResult({ success: true, runId: data.runId });
        setSubject('');
        setContent('');
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
      <h1 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Send Newsletter
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Compose and send to all active newsletter subscribers
      </p>

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
              placeholder={"Write your newsletter here...\n\nUse <b>bold</b>, <i>italic</i>, <a href='...'>links</a>\n\nOr write plain text — it will be wrapped in our branded template."}
              rows={12}
            />
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !content.trim()}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#000' }}>
              {sending ? 'Sending...' : '📨 Send to All Subscribers'}
            </button>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              This will send to every active subscriber
            </span>
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-xl p-4"
          style={{
            background: result.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
          {result.success ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                ✅ Newsletter queued for delivery
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Job ID: {result.runId} — Track progress in your Trigger.dev dashboard
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--error)' }}>
                ❌ Failed to send
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {result.error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 rounded-xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>💡 Tips</h3>
        <div className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
          <p>• The email is wrapped in Ascentor's branded template automatically</p>
          <p>• Each subscriber sees their first name in the greeting</p>
          <p>• Emails are sent in batches to avoid rate limits (100/day on free tier)</p>
          <p>• Track delivery in your <a href="https://cloud.trigger.dev" target="_blank" style={{ color: 'var(--accent)' }}>Trigger.dev dashboard</a></p>
          <p>• HTML tags like &lt;b&gt;, &lt;i&gt;, &lt;a href="..."&gt; are supported in content</p>
        </div>
      </div>
    </div>
  );
}
