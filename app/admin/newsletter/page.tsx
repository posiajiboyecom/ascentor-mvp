'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/components/Modal';

// ============================================================
// ADMIN NEWSLETTER — /admin/newsletter
// Compose, send, manage subscribers and history
// Ascentor brand: Dark #0C0B08 · Gold #E8A020 · Syne · DM Mono · Cormorant Garamond
// ============================================================

export default function AdminNewsletterPage() {
  const supabase = createClient();
  const { alert, confirm, prompt } = useModal();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

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

  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikethrough')) formats.add('strikethrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('bullets');
    if (document.queryCommandState('insertOrderedList')) formats.add('numbers');
    const block = document.queryCommandValue('formatBlock');
    if (block === 'h2') formats.add('h2');
    if (block === 'h3') formats.add('h3');
    if (block === 'p' || block === '') formats.add('p');
    if (document.queryCommandState('justifyLeft')) formats.add('alignLeft');
    if (document.queryCommandState('justifyCenter')) formats.add('alignCenter');
    if (document.queryCommandState('justifyRight')) formats.add('alignRight');
    setActiveFormats(formats);
  }, []);

  useEffect(() => {
    const handler = () => checkActiveFormats();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [checkActiveFormats]);

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setTimeout(() => checkActiveFormats(), 10);
  }, [checkActiveFormats]);

  const setBlock = useCallback((tag: string) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    setTimeout(() => checkActiveFormats(), 10);
  }, [checkActiveFormats]);

  const toggleList = useCallback((cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, undefined);
    setTimeout(() => checkActiveFormats(), 10);
  }, [checkActiveFormats]);

  const clearFormatting = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('removeFormat', false, undefined);
    document.execCommand('formatBlock', false, 'p');
    setTimeout(() => checkActiveFormats(), 10);
  }, [checkActiveFormats]);

  const insertLink = async () => {
    const sel = window.getSelection();
    const selectedText = sel?.toString();
    if (!selectedText) {
      await alert('Select some text first, then click the link button.', 'Add Link');
      return;
    }
    const url = await prompt('Enter the URL:', { title: 'Add Link', placeholder: 'https://example.com' });
    if (url) exec('createLink', url);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { await alert('Please select an image file.', 'Invalid File'); return; }
    if (file.size > 5 * 1024 * 1024) { await alert('Image must be under 5MB.', 'File Too Large'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editorRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;" />`
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertQuote = () => {
    const sel = window.getSelection();
    const text = sel?.toString() || 'Your quote here';
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      `<blockquote style="border-left:3px solid #E8A020;margin:24px 0;padding:16px 24px;font-style:italic;font-size:17px;color:#D4CFC3;background:rgba(232,160,32,0.05);border-radius:0 8px 8px 0;">\u201C${text}\u201D</blockquote><p><br></p>`
    );
  };

  const insertDivider = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      '<hr style="border:none;border-top:1px solid #2E2A22;margin:32px 0;"><p><br></p>'
    );
  };

  const insertNumberedSection = async () => {
    const num = await prompt('Enter the section number:', { title: 'Numbered Section', placeholder: 'e.g. 01' });
    if (!num) return;
    const title = await prompt('Enter the section title:', { title: 'Numbered Section', placeholder: 'e.g. THE MINDSET SHIFT' });
    if (title) {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<h2 style="font-size:22px;font-weight:700;color:#FEF9EC;margin:32px 0 12px;font-family:'Cormorant Garamond',serif;">${num}. ${title.toUpperCase()}</h2><p><br></p>`
      );
    }
  };

  function buildEmailHTML(): string {
    const bodyContent = editorRef.current?.innerHTML || '';
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#0C0B08;font-family:Georgia,'Times New Roman',serif;}
  .wrapper{max-width:640px;margin:0 auto;background:#141310;}
  .header{background:#0C0B08;padding:32px 40px 24px;text-align:center;border-bottom:1px solid #2E2A22;}
  .header-tag{font-family:'DM Mono',monospace,sans-serif;font-size:10px;letter-spacing:0.15em;color:#E8A020;text-transform:uppercase;margin-bottom:12px;}
  .header-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:700;color:#FEF9EC;margin:12px 0 8px;line-height:1.1;}
  .header-subtitle{font-family:'DM Mono',monospace,sans-serif;font-size:12px;color:#4A4438;letter-spacing:0.06em;}
  .header-vol{font-family:'DM Mono',monospace,sans-serif;font-size:11px;color:#4A4438;margin-top:12px;padding-top:12px;border-top:1px solid #2E2A22;letter-spacing:0.08em;text-transform:uppercase;}
  .content{padding:40px;color:#D4CFC3;font-size:16px;line-height:1.8;}
  .content h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#FEF9EC;margin:32px 0 12px;}
  .content h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:600;color:#FEF9EC;margin:24px 0 8px;}
  .content p{margin:0 0 16px;}
  .content blockquote{border-left:3px solid #E8A020;margin:24px 0;padding:16px 24px;font-style:italic;font-size:17px;color:#D4CFC3;background:rgba(232,160,32,0.05);border-radius:0 8px 8px 0;}
  .content img{max-width:100%;height:auto;border-radius:8px;margin:16px 0;}
  .content a{color:#E8A020;text-decoration:underline;}
  .content ul,.content ol{padding-left:24px;margin:12px 0;}
  .content li{margin-bottom:8px;}
  .content hr{border:none;border-top:1px solid #2E2A22;margin:32px 0;}
  .final-word{text-align:center;padding:32px 40px;background:#0C0B08;border-top:1px solid #2E2A22;}
  .final-word p{color:#7A7260;font-family:Georgia,serif;font-size:16px;line-height:1.6;margin:0 0 8px;}
  .final-word .highlight{color:#E8A020;font-weight:700;}
  .footer{background:#0C0B08;padding:24px 40px;text-align:center;border-top:1px solid #2E2A22;}
  .footer-brand{font-family:'DM Mono',monospace,sans-serif;font-size:10px;letter-spacing:0.15em;color:#E8A020;text-transform:uppercase;margin-bottom:8px;}
  .footer-text{font-family:'DM Mono',monospace,sans-serif;font-size:11px;color:#4A4438;line-height:1.8;letter-spacing:0.04em;}
  .footer a{color:#E8A020;text-decoration:none;}
  .social-links{margin:12px 0;}
  .social-links a{display:inline-block;margin:0 8px;color:#7A7260;font-family:'DM Mono',monospace,sans-serif;font-size:11px;text-decoration:none;}
  @media(max-width:640px){.header{padding:24px 20px 16px;}.header-title{font-size:28px;}.content{padding:24px 20px;}.final-word{padding:24px 20px;}.footer{padding:20px;}}
</style></head><body>
<div class="wrapper">
  <div class="header">
    <div class="header-tag">The Rise Letter &middot; Ascentor &middot; For the Ambitious</div>
    <div class="header-title">${subject || 'Untitled'}</div>
    ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ''}
    <div class="header-vol">${volume || 'Vol. 01'} &middot; 5-Min Read</div>
  </div>
  <div class="content">${bodyContent}</div>
  <div class="final-word">
    <p>The world isn\u2019t waiting for a perfect leader.</p>
    <p>It\u2019s waiting for a <span class="highlight">real one.</span></p>
    <p style="color:#4A4438;font-size:13px;margin-top:16px;font-family:'DM Mono',monospace,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">That\u2019s you \u2014 if you choose to show up.</p>
  </div>
  <div class="footer">
    <div class="footer-brand">Ascentor</div>
    <div class="footer-text">Africa\u2019s mentorship platform</div>
    <div class="social-links"><a href="https://ascentor.co">ascentor.co</a></div>
    <div class="footer-text" style="margin-top:16px;font-size:10px;">You received this because you subscribed to The Rise Letter.<br><a href="#" style="color:#4A4438;">Unsubscribe</a></div>
  </div>
</div>
</body></html>`;
  }

  async function handleSend() {
    if (!subject.trim() || !editorRef.current?.innerHTML.trim()) return;
    const confirmed = await confirm(`Send this newsletter to ${subCount} active subscribers?`, 'Send Newsletter');
    if (!confirmed) return;
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
    const confirmed = await confirm(`Remove ${email} from subscribers?`, 'Remove Subscriber');
    if (!confirmed) return;
    await supabase.from('newsletter_subscribers').delete().eq('id', id);
    loadData();
  }

  // ─── Shared style tokens ──────────────────────────────────────────────────
  const card: React.CSSProperties = { background: '#141310', border: '1px solid #2E2A22', borderRadius: '12px' };
  const inputBase: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #2E2A22', background: '#1E1C17',
    color: '#D4CFC3', fontSize: '13px',
    fontFamily: "'Syne', sans-serif", outline: 'none',
    transition: 'border-color 0.2s',
  };
  const monoLabel: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace", fontSize: '10px',
    letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#4A4438',
  };
  const fieldLabel: React.CSSProperties = { ...monoLabel, display: 'block', marginBottom: '6px' };

  // ─── Toolbar button ───────────────────────────────────────────────────────
  const ToolBtn = ({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        width: '30px', height: '30px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px',
        background: active ? 'rgba(232,160,32,0.15)' : 'transparent',
        color: active ? '#E8A020' : '#7A7260',
        border: active ? '1px solid rgba(232,160,32,0.35)' : '1px solid transparent',
        fontFamily: "'Syne', sans-serif",
        fontSize: '11px', fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );

  const ToolSep = () => (
    <div style={{ width: '1px', height: '20px', background: '#2E2A22', margin: '0 3px', flexShrink: 0 }} />
  );

  return (
    <div style={{ animation: 'asc-fade-up 0.35s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0);} }
        @keyframes asc-spin    { to { transform:rotate(360deg);} }
        .asc-input:focus       { border-color: #E8A020 !important; }
        .asc-input:hover       { border-color: #4A4438 !important; }
        .asc-tab-btn:hover     { color: #D4CFC3 !important; }
        .asc-tool-btn:hover    { background: #1E1C17 !important; color: #D4CFC3 !important; border-color: #2E2A22 !important; }
        .asc-ghost:hover       { border-color: #E8A020 !important; color: #E8A020 !important; }
        .asc-sub-row:hover     { background: #1A1815 !important; }
        .asc-history-row:hover { border-color: #4A4438 !important; }
        .asc-editor { line-height: 1.8; font-family: 'Syne', sans-serif; }
        .asc-editor h2 { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 700; color: #FEF9EC; margin: 28px 0 10px; }
        .asc-editor h3 { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 600; color: #FEF9EC; margin: 20px 0 8px; }
        .asc-editor p  { margin: 0 0 14px; }
        .asc-editor a  { color: #E8A020; }
        .asc-editor blockquote { border-left: 3px solid #E8A020; margin: 20px 0; padding: 14px 20px; font-style: italic; background: rgba(232,160,32,0.05); border-radius: 0 8px 8px 0; color: #D4CFC3; }
        .asc-editor ul, .asc-editor ol { padding-left: 22px; margin: 10px 0; }
        .asc-editor li { margin-bottom: 6px; }
      `}</style>

      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', fontWeight: 700, color: '#FEF9EC', margin: 0, lineHeight: 1.1 }}>
          Newsletter
        </h1>
        <span style={{
          ...monoLabel,
          background: 'rgba(232,160,32,0.08)',
          color: '#E8A020',
          border: '1px solid rgba(232,160,32,0.2)',
          padding: '4px 12px',
          borderRadius: '100px',
        }}>
          {subCount} active
        </span>
      </div>
      <p style={{ ...monoLabel, marginBottom: '24px' }}>
        {history.length} sent &middot; {subscribers.length} subscribers
      </p>

      {/* ─── Tab Bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', padding: '4px', background: '#1E1C17', borderRadius: '10px', border: '1px solid #2E2A22' }}>
        {(['compose', 'subscribers', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="asc-tab-btn"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '7px',
              border: 'none',
              background: tab === t ? '#141310' : 'transparent',
              color: tab === t ? '#E8A020' : '#4A4438',
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'compose' ? 'Compose' : t === 'subscribers' ? `Subs (${subscribers.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* ═══ COMPOSE TAB ═══════════════════════════════════════════════════ */}
      {tab === 'compose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...card, padding: '24px' }}>

            {/* Meta fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ ...fieldLabel }}>Headline / Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. You Were Born to Lead."
                  className="asc-input"
                  style={{ ...inputBase }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ ...fieldLabel }}>Volume</label>
                  <input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Vol. 01" className="asc-input" style={{ ...inputBase }} />
                </div>
                <div>
                  <label style={{ ...fieldLabel }}>Subtitle</label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="For Ambitious Professionals" className="asc-input" style={{ ...inputBase }} />
                </div>
              </div>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

            {/* ─── Toolbar ──────────────────────────────────────────────── */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px',
              padding: '8px 10px',
              background: '#1E1C17',
              border: '1px solid #2E2A22',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
            }}>
              <ToolBtn onClick={() => exec('bold')} title="Bold" active={activeFormats.has('bold')}><b>B</b></ToolBtn>
              <ToolBtn onClick={() => exec('italic')} title="Italic" active={activeFormats.has('italic')}><i>I</i></ToolBtn>
              <ToolBtn onClick={() => exec('underline')} title="Underline" active={activeFormats.has('underline')}><u>U</u></ToolBtn>
              <ToolBtn onClick={() => exec('strikethrough')} title="Strikethrough" active={activeFormats.has('strikethrough')}><s>S</s></ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => setBlock('h2')} title="Large Heading" active={activeFormats.has('h2')}>H2</ToolBtn>
              <ToolBtn onClick={() => setBlock('h3')} title="Small Heading" active={activeFormats.has('h3')}>H3</ToolBtn>
              <ToolBtn onClick={() => setBlock('p')} title="Normal Text" active={activeFormats.has('p')}>P</ToolBtn>
              <ToolSep />
              <ToolBtn onClick={insertLink} title="Add Link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => fileInputRef.current?.click()} title="Upload Image">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              </ToolBtn>
              <ToolBtn onClick={insertQuote} title="Blockquote">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
              </ToolBtn>
              <ToolBtn onClick={insertDivider} title="Divider Line">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
              </ToolBtn>
              <ToolBtn onClick={insertNumberedSection} title="Numbered Section">
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 700 }}>#</span>
              </ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => toggleList('insertUnorderedList')} title="Bullet List" active={activeFormats.has('bullets')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => toggleList('insertOrderedList')} title="Numbered List" active={activeFormats.has('numbers')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none">3</text></svg>
              </ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => exec('justifyLeft')} title="Align Left" active={activeFormats.has('alignLeft')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => exec('justifyCenter')} title="Align Center" active={activeFormats.has('alignCenter')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => exec('justifyRight')} title="Align Right" active={activeFormats.has('alignRight')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
              </ToolBtn>
              <ToolSep />
              <ToolBtn onClick={clearFormatting} title="Clear Formatting">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </ToolBtn>
            </div>

            {/* ─── Editor ───────────────────────────────────────────────── */}
            <div
              ref={editorRef}
              contentEditable
              className="asc-editor asc-input"
              style={{
                minHeight: '400px',
                padding: '20px',
                background: '#1E1C17',
                color: '#D4CFC3',
                border: '1px solid #2E2A22',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                outline: 'none',
                fontSize: '14px',
              }}
              suppressContentEditableWarning
              onClick={checkActiveFormats}
              onKeyUp={checkActiveFormats}
              onFocus={(e) => {
                if ((e.target as HTMLDivElement).textContent === '') {
                  (e.target as HTMLDivElement).innerHTML = '<p><br></p>';
                }
              }}
            />

            {/* ─── Action Buttons ───────────────────────────────────────── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim()}
                style={{
                  padding: '11px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#E8A020',
                  color: '#0C0B08',
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: sending || !subject.trim() ? 'not-allowed' : 'pointer',
                  opacity: sending || !subject.trim() ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                  letterSpacing: '0.02em',
                }}
              >
                {sending ? 'Sending...' : `Send to ${subCount} Subscribers`}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="asc-ghost"
                style={{
                  padding: '11px 22px',
                  borderRadius: '8px',
                  border: '1px solid #2E2A22',
                  background: 'transparent',
                  color: '#7A7260',
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                {showPreview ? 'Close Preview' : 'Preview Email'}
              </button>
            </div>

            {result && (
              <div style={{
                marginTop: '14px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: result.success ? 'rgba(20,184,166,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${result.success ? 'rgba(20,184,166,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                <p style={{ ...monoLabel, color: result.success ? '#14B8A6' : '#EF4444', fontSize: '11px' }}>
                  {result.success ? `Queued successfully — Run ID: ${result.runId}` : `Error: ${result.error}`}
                </p>
              </div>
            )}
          </div>

          {/* ─── Email Preview ────────────────────────────────────────────── */}
          {showPreview && (
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8A020' }}>
              <div style={{
                padding: '8px 16px',
                background: 'rgba(232,160,32,0.08)',
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E8A020',
              }}>
                Email Preview — How subscribers will see it
              </div>
              <iframe srcDoc={buildEmailHTML()} style={{ width: '100%', border: 'none', minHeight: '700px', background: '#0C0B08' }} title="Preview" />
            </div>
          )}
        </div>
      )}

      {/* ═══ SUBSCRIBERS TAB ═══════════════════════════════════════════════ */}
      {tab === 'subscribers' && (
        <>
          {subscribers.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '14px', color: '#4A4438' }}>No subscribers yet.</p>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {/* Desktop table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2E2A22' }}>
                      {['Email', 'Name', 'Source', 'Subscribed', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ ...monoLabel, padding: '12px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="asc-sub-row" style={{ borderBottom: '1px solid #2E2A22', opacity: sub.is_active ? 1 : 0.5 }}>
                        <td style={{ padding: '12px 16px', fontFamily: "'Syne', sans-serif", color: '#D4CFC3', fontSize: '13px' }}>{sub.email}</td>
                        <td style={{ padding: '12px 16px', fontFamily: "'Syne', sans-serif", color: '#7A7260', fontSize: '12px' }}>{sub.first_name || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ ...monoLabel, background: 'rgba(232,160,32,0.08)', color: '#E8A020', padding: '2px 8px', borderRadius: '100px', fontSize: '9px' }}>
                            {sub.source || 'website'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ ...monoLabel, fontSize: '10px' }}>
                            {new Date(sub.subscribed_at || sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            ...monoLabel, fontSize: '9px',
                            padding: '2px 8px', borderRadius: '100px',
                            background: sub.is_active ? 'rgba(20,184,166,0.1)' : 'rgba(74,68,56,0.15)',
                            color: sub.is_active ? '#14B8A6' : '#4A4438',
                          }}>
                            {sub.is_active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => toggleSubscriber(sub.id, sub.is_active)}
                              className="asc-ghost"
                              style={{
                                padding: '4px 10px', borderRadius: '6px',
                                border: '1px solid #2E2A22', background: 'transparent',
                                color: '#7A7260', fontFamily: "'Syne', sans-serif",
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                transition: 'border-color 0.15s, color 0.15s',
                              }}
                            >
                              {sub.is_active ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => deleteSubscriber(sub.id, sub.email)}
                              style={{
                                padding: '4px 10px', borderRadius: '6px',
                                border: '1px solid rgba(239,68,68,0.25)', background: 'transparent',
                                color: '#EF4444', fontFamily: "'Syne', sans-serif",
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ HISTORY TAB ═══════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {history.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '14px', color: '#4A4438' }}>No newsletters sent yet.</p>
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} className="asc-history-row" style={{ ...card, padding: '18px 20px', transition: 'border-color 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', fontWeight: 700, color: '#FEF9EC', margin: '0 0 4px' }}>
                    {item.subject}
                  </h4>
                  <p style={{ ...monoLabel }}>
                    {item.subscriber_count} subscribers &middot; {new Date(item.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span style={{
                  ...monoLabel, fontSize: '9px',
                  padding: '3px 10px', borderRadius: '100px',
                  background: 'rgba(20,184,166,0.1)', color: '#14B8A6',
                  flexShrink: 0,
                }}>
                  {item.status}
                </span>
              </div>
              <details>
                <summary style={{ ...monoLabel, cursor: 'pointer', userSelect: 'none' }}>Preview email</summary>
                <iframe srcDoc={item.content} style={{ width: '100%', border: 'none', minHeight: '500px', background: '#0C0B08', borderRadius: '8px', marginTop: '10px' }} title="Preview" />
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
