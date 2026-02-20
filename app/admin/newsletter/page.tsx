'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminNewsletterPage() {
  const supabase = createClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [subject, setSubject] = useState('');
  const [volume, setVolume] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [tab, setTab] = useState<'compose' | 'subscribers' | 'history'>('compose');
  const [showPreview, setShowPreview] = useState(false);

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

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }, []);

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) exec('insertImage', url);
  };

  const insertQuote = () => {
    const sel = window.getSelection();
    const text = sel?.toString() || 'Your quote here';
    exec('insertHTML', `<blockquote style="border-left:4px solid #F59E0B;margin:24px 0;padding:16px 24px;font-style:italic;font-size:17px;color:#374151;background:#FFFBEB;border-radius:0 8px 8px 0;">\u201C${text}\u201D</blockquote>`);
  };

  const insertDivider = () => {
    exec('insertHTML', '<hr style="border:none;border-top:2px solid #F59E0B;margin:32px 0;">');
  };

  const insertNumberedSection = () => {
    const num = prompt('Section number (e.g. 01, 02):');
    const title = prompt('Section title:');
    if (num && title) {
      exec('insertHTML', `<h2 style="font-size:22px;font-weight:800;color:#111827;margin:32px 0 12px;font-family:Georgia,serif;">${num}. ${title.toUpperCase()}</h2>`);
    }
  };

  const insertEmoji = () => {
    const emojis = ['\uD83E\uDDE0', '\uD83C\uDFAF', '\uD83D\uDD01', '\uD83D\uDCA1', '\uD83D\uDD25', '\u2728', '\uD83D\uDE80', '\uD83D\uDCAA', '\uD83C\uDF0D', '\uD83D\uDCCC', '\u26A1', '\uD83C\uDFC6'];
    const emoji = prompt(`Pick one:\n${emojis.join(' ')}`);
    if (emoji) exec('insertText', emoji);
  };

  function buildEmailHTML(): string {
    const bodyContent = editorRef.current?.innerHTML || '';
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#F9FAFB;font-family:Georgia,'Times New Roman',serif;}
  .wrapper{max-width:640px;margin:0 auto;background:#FFFFFF;}
  .header{background:#111827;padding:32px 40px 24px;text-align:center;}
  .header-tag{font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#F59E0B;text-transform:uppercase;margin-bottom:8px;}
  .header-title{font-size:36px;font-weight:800;color:#FFFFFF;margin:16px 0 8px;line-height:1.1;}
  .header-subtitle{font-size:14px;color:#9CA3AF;font-family:Arial,sans-serif;}
  .header-vol{font-size:12px;color:#6B7280;font-family:Arial,sans-serif;margin-top:12px;padding-top:12px;border-top:1px solid #374151;}
  .content{padding:40px;color:#374151;font-size:16px;line-height:1.8;}
  .content h2{font-size:22px;font-weight:800;color:#111827;margin:32px 0 12px;font-family:Georgia,serif;}
  .content h3{font-size:18px;font-weight:700;color:#111827;margin:24px 0 8px;}
  .content p{margin:0 0 16px;}
  .content blockquote{border-left:4px solid #F59E0B;margin:24px 0;padding:16px 24px;font-style:italic;font-size:17px;color:#374151;background:#FFFBEB;border-radius:0 8px 8px 0;}
  .content img{max-width:100%;height:auto;border-radius:8px;margin:16px 0;}
  .content a{color:#F59E0B;text-decoration:underline;}
  .content ul,.content ol{padding-left:24px;margin:12px 0;}
  .content li{margin-bottom:8px;}
  .content hr{border:none;border-top:2px solid #F59E0B;margin:32px 0;}
  .final-word{text-align:center;padding:32px 40px;background:#111827;}
  .final-word p{color:#D1D5DB;font-size:18px;line-height:1.6;margin:0 0 8px;}
  .final-word .highlight{color:#F59E0B;font-weight:700;font-size:20px;}
  .footer{background:#F9FAFB;padding:24px 40px;text-align:center;font-family:Arial,sans-serif;}
  .footer-brand{font-size:11px;letter-spacing:2px;color:#F59E0B;text-transform:uppercase;margin-bottom:8px;}
  .footer-text{font-size:12px;color:#9CA3AF;line-height:1.6;}
  .footer a{color:#F59E0B;text-decoration:none;}
  .social-links{margin:16px 0;}
  .social-links a{display:inline-block;margin:0 8px;color:#6B7280;text-decoration:none;font-size:13px;}
  @media(max-width:640px){.header{padding:24px 20px 16px;}.header-title{font-size:28px;}.content{padding:24px 20px;}.final-word{padding:24px 20px;}.footer{padding:20px;}}
</style></head><body>
<div class="wrapper">
  <div class="header">
    <div class="header-tag">THE RISE LETTER \u2022 LEADERSHIP EDITION \u2022 FOR THE NEXT GENERATION</div>
    <div class="header-title">${subject || 'Untitled'}</div>
    ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ''}
    <div class="header-vol">${volume || 'Vol. 01'} | For Ambitious Professionals | 5-Min Read</div>
  </div>
  <div class="content">${bodyContent}</div>
  <div class="final-word">
    <p>The world isn\u2019t waiting for a perfect leader.</p>
    <p>It\u2019s waiting for a <span class="highlight">real one.</span></p>
    <p style="color:#9CA3AF;font-size:14px;margin-top:16px;">That\u2019s you \u2014 if you choose to show up.</p>
  </div>
  <div class="footer">
    <div class="footer-brand">THE RISE LETTER</div>
    <div class="footer-text">Empowering the Next Generation of Leaders</div>
    <div class="social-links"><a href="https://www.ascentorbi.com">Website</a> \u2022 <a href="https://www.ascentorbi.com/blog">Blog</a></div>
    <div class="footer-text" style="margin-top:12px;">Share this with someone who needs it.<br><a href="https://www.ascentorbi.com" style="color:#F59E0B;">www.ascentorbi.com</a></div>
    <div class="footer-text" style="margin-top:16px;font-size:11px;color:#D1D5DB;">You received this because you subscribed to The Rise Letter.<br><a href="#" style="color:#9CA3AF;">Unsubscribe</a></div>
  </div>
</div>
</body></html>`;
  }

  async function handleSend() {
    if (!subject.trim() || !editorRef.current?.innerHTML.trim()) return;
    if (!confirm(`Send this newsletter to ${subCount} active subscribers?`)) return;
    setSending(true);
    setResult(null);
    const emailHTML = buildEmailHTML();
    try {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: `The Rise Letter: ${subject}`, content: emailHTML }),
      });
      const data = await res.json();
      if (res.ok) {
        await supabase.from('sent_newsletters').insert({ subject, content: emailHTML, sent_by: 'admin', subscriber_count: subCount, status: 'sent', trigger_run_id: data.runId || null });
        setResult({ success: true, runId: data.runId });
        setSubject(''); setVolume(''); setSubtitle('');
        if (editorRef.current) editorRef.current.innerHTML = '';
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
    if (!confirm(`Remove ${email}?`)) return;
    await supabase.from('newsletter_subscribers').delete().eq('id', id);
    loadData();
  }

  const ToolBtn = ({ onClick, title, children }: any) => (
    <button onClick={onClick} title={title} className="w-8 h-8 flex items-center justify-center rounded-md text-sm transition-all hover:scale-105"
      style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{children}</button>
  );
  const ToolSep = () => <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
        <h1 className="text-xl md:text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>Newsletter</h1>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>{subCount} active</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{history.length} sent \u00B7 {subscribers.length} subscribers</p>

      <div className="flex gap-1 mb-5 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {(['compose', 'subscribers', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-md text-xs font-semibold whitespace-nowrap px-2"
            style={{ background: tab === t ? 'var(--bg-card)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)' }}>
            {t === 'compose' ? '\u270F\uFE0F Compose' : t === 'subscribers' ? `\uD83D\uDC65 Subs (${subscribers.length})` : `\uD83D\uDCCB History (${history.length})`}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Headline / Subject</label>
                <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                  value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. You Were Born to Lead." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Volume</label>
                  <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                    value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Vol. 01" />
                </div>
                <div>
                  <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>Subtitle</label>
                  <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                    value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="For Ambitious 18-25 Year Olds" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-2 rounded-t-xl" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border)' }}>
              <ToolBtn onClick={() => exec('bold')} title="Bold"><b>B</b></ToolBtn>
              <ToolBtn onClick={() => exec('italic')} title="Italic"><i>I</i></ToolBtn>
              <ToolBtn onClick={() => exec('underline')} title="Underline"><u>U</u></ToolBtn>
              <ToolBtn onClick={() => exec('strikethrough')} title="Strikethrough"><s>S</s></ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => exec('formatBlock', '<h2>')} title="Heading">H2</ToolBtn>
              <ToolBtn onClick={() => exec('formatBlock', '<h3>')} title="Subheading">H3</ToolBtn>
              <ToolBtn onClick={() => exec('formatBlock', '<p>')} title="Paragraph">P</ToolBtn>
              <ToolSep />
              <ToolBtn onClick={insertLink} title="Link">\uD83D\uDD17</ToolBtn>
              <ToolBtn onClick={insertImage} title="Image">\uD83D\uDDBC\uFE0F</ToolBtn>
              <ToolBtn onClick={insertQuote} title="Quote">\u275D</ToolBtn>
              <ToolBtn onClick={insertDivider} title="Divider">\u2014</ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => exec('insertUnorderedList')} title="Bullets">\u2022</ToolBtn>
              <ToolBtn onClick={() => exec('insertOrderedList')} title="Numbers">1.</ToolBtn>
              <ToolBtn onClick={insertNumberedSection} title="Section">\u00A7</ToolBtn>
              <ToolBtn onClick={insertEmoji} title="Emoji">\uD83D\uDE0A</ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => exec('justifyLeft')} title="Left">\u25E7</ToolBtn>
              <ToolBtn onClick={() => exec('justifyCenter')} title="Center">\u25EB</ToolBtn>
              <ToolBtn onClick={() => exec('removeFormat')} title="Clear">\u2715</ToolBtn>
            </div>

            <div ref={editorRef} contentEditable className="min-h-[400px] px-5 py-4 text-sm rounded-b-xl focus:outline-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', borderTop: 'none', lineHeight: '1.8', fontFamily: 'Georgia, serif' }}
              suppressContentEditableWarning
              onFocus={(e) => { if ((e.target as HTMLDivElement).textContent === '') (e.target as HTMLDivElement).innerHTML = '<p><br></p>'; }} />

            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={handleSend} disabled={sending || !subject.trim()} className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#000' }}>
                {sending ? 'Sending...' : `\uD83D\uDCE8 Send to ${subCount} Subscribers`}
              </button>
              <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {showPreview ? '\u2715 Close Preview' : '\uD83D\uDC41\uFE0F Preview Email'}
              </button>
            </div>

            {result && (
              <div className="rounded-xl p-3 mt-4" style={{ background: result.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <p className="text-xs" style={{ color: result.success ? 'var(--success)' : 'var(--error)' }}>{result.success ? `\u2705 Queued \u2014 ${result.runId}` : `\u274C ${result.error}`}</p>
              </div>
            )}
          </div>

          {showPreview && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--accent)' }}>
              <div className="px-4 py-2 text-xs font-bold" style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)' }}>\uD83D\uDCE7 Email Preview</div>
              <iframe srcDoc={buildEmailHTML()} className="w-full border-0" style={{ minHeight: '700px', background: '#F9FAFB' }} title="Preview" />
            </div>
          )}
        </div>
      )}

      {tab === 'subscribers' && (
        <>
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              <div className="col-span-4">Email</div><div className="col-span-2">Name</div><div className="col-span-2">Source</div><div className="col-span-2">Subscribed</div><div className="col-span-2 text-center">Actions</div>
            </div>
            {subscribers.map((sub) => (
              <div key={sub.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center" style={{ borderBottom: '1px solid var(--border)', opacity: sub.is_active ? 1 : 0.5 }}>
                <div className="col-span-4"><p className="text-sm truncate" style={{ color: 'var(--text)' }}>{sub.email}</p></div>
                <div className="col-span-2"><p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{sub.first_name || '\u2014'}</p></div>
                <div className="col-span-2"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>{sub.source || 'website'}</span></div>
                <div className="col-span-2"><p className="text-xs" style={{ color: 'var(--text-dim)' }}>{new Date(sub.subscribed_at || sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                <div className="col-span-2 flex gap-1 justify-center">
                  <button onClick={() => toggleSubscriber(sub.id, sub.is_active)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: sub.is_active ? 'var(--text-dim)' : 'var(--success)', border: '1px solid var(--border)' }}>{sub.is_active ? 'Pause' : 'Activate'}</button>
                  <button onClick={() => deleteSubscriber(sub.id, sub.email)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>\u2715</button>
                </div>
              </div>
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {subscribers.map((sub) => (
              <div key={sub.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: sub.is_active ? 1 : 0.5 }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{sub.email}</p>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{sub.first_name || 'No name'} \u00B7 {sub.source || 'website'}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2" style={{ background: sub.is_active ? 'rgba(16,185,129,0.09)' : 'rgba(107,114,128,0.09)', color: sub.is_active ? 'var(--success)' : 'var(--text-dim)' }}>{sub.is_active ? 'Active' : 'Paused'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleSubscriber(sub.id, sub.is_active)} className="text-[11px] px-3 py-1 rounded-lg" style={{ color: sub.is_active ? 'var(--text-dim)' : 'var(--success)', border: '1px solid var(--border)' }}>{sub.is_active ? 'Pause' : 'Activate'}</button>
                  <button onClick={() => deleteSubscriber(sub.id, sub.email)} className="text-[11px] px-3 py-1 rounded-lg" style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          {subscribers.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-2">\uD83D\uDCED</p><p className="text-sm" style={{ color: 'var(--text-dim)' }}>No subscribers yet</p></div>}
        </>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          {history.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-3">\uD83D\uDCED</p><p className="text-sm" style={{ color: 'var(--text-dim)' }}>No newsletters sent yet</p></div>}
          {history.map((item) => (
            <div key={item.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.subject}</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{item.subscriber_count} subs \u00B7 {new Date(item.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>{item.status}</span>
              </div>
              <details>
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>Preview email</summary>
                <iframe srcDoc={item.content} className="w-full border-0 mt-2 rounded-lg" style={{ minHeight: '500px', background: '#F9FAFB' }} title="Preview" />
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
