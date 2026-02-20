'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminNewsletterPage() {
  const supabase = createClient();
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Track active formatting states
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

  // Check which formats are currently active at cursor position
  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikethrough')) formats.add('strikethrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('bullets');
    if (document.queryCommandState('insertOrderedList')) formats.add('numbers');

    // Check block format
    const block = document.queryCommandValue('formatBlock');
    if (block === 'h2') formats.add('h2');
    if (block === 'h3') formats.add('h3');
    if (block === 'p' || block === '') formats.add('p');

    // Check alignment
    if (document.queryCommandState('justifyLeft')) formats.add('alignLeft');
    if (document.queryCommandState('justifyCenter')) formats.add('alignCenter');
    if (document.queryCommandState('justifyRight')) formats.add('alignRight');

    setActiveFormats(formats);
  }, []);

  // Run format check on selection change and keyup
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

  // ═══ TOOLBAR ACTIONS ═══

  const insertLink = () => {
    const sel = window.getSelection();
    const selectedText = sel?.toString();
    if (!selectedText) {
      alert('Select some text first, then click the link button to add a URL to it.');
      return;
    }
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (url) exec('createLink', url);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editorRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;" />`
      );
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const insertQuote = () => {
    const sel = window.getSelection();
    const text = sel?.toString() || 'Your quote here';
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      `<blockquote style="border-left:4px solid #F59E0B;margin:24px 0;padding:16px 24px;font-style:italic;font-size:17px;color:#374151;background:#FFFBEB;border-radius:0 8px 8px 0;">\u201C${text}\u201D</blockquote><p><br></p>`
    );
  };

  const insertDivider = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      '<hr style="border:none;border-top:2px solid #F59E0B;margin:32px 0;"><p><br></p>'
    );
  };

  const insertNumberedSection = () => {
    const num = prompt('Section number (e.g. 01, 02):');
    const title = prompt('Section title:');
    if (num && title) {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<h2 style="font-size:22px;font-weight:800;color:#111827;margin:32px 0 12px;font-family:Georgia,serif;">${num}. ${title.toUpperCase()}</h2><p><br></p>`
      );
    }
  };

  // Emoji data
  const emojiCategories = [
    { label: 'Leadership', emojis: ['🧠', '🎯', '💡', '🔥', '✨', '🚀', '💪', '🏆', '⚡', '🌍'] },
    { label: 'People', emojis: ['👋', '🙌', '👏', '🤝', '💬', '👥', '🧑\u200D💼', '👩\u200D💻', '🧑\u200D🎓', '🫡'] },
    { label: 'Objects', emojis: ['📌', '📝', '📚', '🔗', '📊', '🗓️', '💰', '🎓', '📢', '🔔'] },
    { label: 'Symbols', emojis: ['✅', '❌', '⭐', '❤️', '💎', '🔁', '➡️', '⬆️', '🔹', '🔸'] },
  ];

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
    <div class="social-links"><a href="https://www.ascentorbi.com">Website</a> &bull; <a href="https://www.ascentorbi.com/blog">Blog</a></div>
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

  // ═══ TOOLBAR BUTTON COMPONENT ═══
  const ToolBtn = ({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-md text-xs transition-all hover:scale-105 relative group"
      style={{
        background: active ? 'rgba(245,158,11,0.2)' : 'var(--bg-input)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        fontWeight: active ? 700 : 400,
      }}>
      {children}
      {/* Tooltip */}
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: 'var(--text)', color: 'var(--bg)' }}>{title}</span>
    </button>
  );

  const ToolSep = () => <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
        <h1 className="text-xl md:text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>Newsletter</h1>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>{subCount} active</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{history.length} sent &middot; {subscribers.length} subscribers</p>

      <div className="flex gap-1 mb-5 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {(['compose', 'subscribers', 'history'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setShowEmojiPicker(false); }} className="flex-1 py-2 rounded-md text-xs font-semibold whitespace-nowrap px-2"
            style={{ background: tab === t ? 'var(--bg-card)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)' }}>
            {t === 'compose' ? 'Compose' : t === 'subscribers' ? `Subs (${subscribers.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* ═══ COMPOSE TAB ═══ */}
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

            {/* Hidden file input for image upload */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            {/* ═══ TOOLBAR ═══ */}
            <div className="flex flex-wrap items-center gap-1 p-2 rounded-t-xl relative" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border)' }}>
              <ToolBtn onClick={() => exec('bold')} title="Bold (Ctrl+B)" active={activeFormats.has('bold')}><b>B</b></ToolBtn>
              <ToolBtn onClick={() => exec('italic')} title="Italic (Ctrl+I)" active={activeFormats.has('italic')}><i>I</i></ToolBtn>
              <ToolBtn onClick={() => exec('underline')} title="Underline (Ctrl+U)" active={activeFormats.has('underline')}><u>U</u></ToolBtn>
              <ToolBtn onClick={() => exec('strikethrough')} title="Strikethrough" active={activeFormats.has('strikethrough')}><s>S</s></ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => setBlock('h2')} title="Large Heading" active={activeFormats.has('h2')}>H2</ToolBtn>
              <ToolBtn onClick={() => setBlock('h3')} title="Small Heading" active={activeFormats.has('h3')}>H3</ToolBtn>
              <ToolBtn onClick={() => setBlock('p')} title="Normal Text" active={activeFormats.has('p')}>P</ToolBtn>
              <ToolSep />
              <ToolBtn onClick={insertLink} title="Add Link (select text first)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => fileInputRef.current?.click()} title="Upload Image">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              </ToolBtn>
              <ToolBtn onClick={insertQuote} title="Blockquote">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
              </ToolBtn>
              <ToolBtn onClick={insertDivider} title="Gold Divider Line">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
              </ToolBtn>
              <ToolSep />
              <ToolBtn onClick={() => toggleList('insertUnorderedList')} title="Bullet List" active={activeFormats.has('bullets')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => toggleList('insertOrderedList')} title="Numbered List" active={activeFormats.has('numbers')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="3" y="8" fontSize="7" fill="currentColor" stroke="none">1</text><text x="3" y="14" fontSize="7" fill="currentColor" stroke="none">2</text><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none">3</text></svg>
              </ToolBtn>
              <ToolBtn onClick={insertNumberedSection} title="Numbered Section (01. TITLE)">
                <span style={{ fontSize: '11px', fontWeight: 700 }}>#</span>
              </ToolBtn>
              <ToolSep />
              <div className="relative">
                <ToolBtn onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Insert Emoji" active={showEmojiPicker}>
                  <span style={{ fontSize: '14px' }}>😊</span>
                </ToolBtn>
                {showEmojiPicker && (
                  <div className="absolute top-10 left-0 z-50 rounded-xl p-3 shadow-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', width: '260px' }}>
                    {emojiCategories.map((cat) => (
                      <div key={cat.label} className="mb-2">
                        <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-dim)' }}>{cat.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {cat.emojis.map((emoji) => (
                            <button key={emoji}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                editorRef.current?.focus();
                                document.execCommand('insertText', false, emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md text-lg hover:scale-125 transition-transform"
                              style={{ background: 'transparent' }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ToolSep />
              <ToolBtn onClick={() => exec('justifyLeft')} title="Align Left" active={activeFormats.has('alignLeft')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => exec('justifyCenter')} title="Align Center" active={activeFormats.has('alignCenter')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              </ToolBtn>
              <ToolBtn onClick={() => exec('justifyRight')} title="Align Right" active={activeFormats.has('alignRight')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
              </ToolBtn>
              <ToolSep />
              <ToolBtn onClick={clearFormatting} title="Clear All Formatting">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </ToolBtn>
            </div>

            {/* ═══ EDITOR ═══ */}
            <div
              ref={editorRef}
              contentEditable
              className="min-h-[400px] px-5 py-4 text-sm rounded-b-xl focus:outline-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderTop: 'none',
                lineHeight: '1.8',
                fontFamily: 'Georgia, serif',
              }}
              suppressContentEditableWarning
              onClick={() => { checkActiveFormats(); setShowEmojiPicker(false); }}
              onKeyUp={checkActiveFormats}
              onFocus={(e) => {
                if ((e.target as HTMLDivElement).textContent === '') {
                  (e.target as HTMLDivElement).innerHTML = '<p><br></p>';
                }
              }}
            />

            {/* ═══ ACTION BUTTONS ═══ */}
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={handleSend} disabled={sending || !subject.trim()} className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#000' }}>
                {sending ? 'Sending...' : `Send to ${subCount} Subscribers`}
              </button>
              <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {showPreview ? 'Close Preview' : 'Preview Email'}
              </button>
            </div>

            {result && (
              <div className="rounded-xl p-3 mt-4" style={{ background: result.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <p className="text-xs" style={{ color: result.success ? 'var(--success)' : 'var(--error)' }}>
                  {result.success ? `Queued successfully - Run ID: ${result.runId}` : `Error: ${result.error}`}
                </p>
              </div>
            )}
          </div>

          {/* ═══ EMAIL PREVIEW ═══ */}
          {showPreview && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--accent)' }}>
              <div className="px-4 py-2 text-xs font-bold" style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)' }}>
                Email Preview - How subscribers will see it
              </div>
              <iframe srcDoc={buildEmailHTML()} className="w-full border-0" style={{ minHeight: '700px', background: '#F9FAFB' }} title="Preview" />
            </div>
          )}
        </div>
      )}

      {/* ═══ SUBSCRIBERS TAB ═══ */}
      {tab === 'subscribers' && (
        <>
          <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              <div className="col-span-4">Email</div><div className="col-span-2">Name</div><div className="col-span-2">Source</div><div className="col-span-2">Subscribed</div><div className="col-span-2 text-center">Actions</div>
            </div>
            {subscribers.map((sub) => (
              <div key={sub.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center" style={{ borderBottom: '1px solid var(--border)', opacity: sub.is_active ? 1 : 0.5 }}>
                <div className="col-span-4"><p className="text-sm truncate" style={{ color: 'var(--text)' }}>{sub.email}</p></div>
                <div className="col-span-2"><p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{sub.first_name || '—'}</p></div>
                <div className="col-span-2"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>{sub.source || 'website'}</span></div>
                <div className="col-span-2"><p className="text-xs" style={{ color: 'var(--text-dim)' }}>{new Date(sub.subscribed_at || sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                <div className="col-span-2 flex gap-1 justify-center">
                  <button onClick={() => toggleSubscriber(sub.id, sub.is_active)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: sub.is_active ? 'var(--text-dim)' : 'var(--success)', border: '1px solid var(--border)' }}>{sub.is_active ? 'Pause' : 'Activate'}</button>
                  <button onClick={() => deleteSubscriber(sub.id, sub.email)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>X</button>
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
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{sub.first_name || 'No name'} &middot; {sub.source || 'website'}</p>
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
          {subscribers.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-2">📭</p><p className="text-sm" style={{ color: 'var(--text-dim)' }}>No subscribers yet</p></div>}
        </>
      )}

      {/* ═══ HISTORY TAB ═══ */}
      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          {history.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-3">📭</p><p className="text-sm" style={{ color: 'var(--text-dim)' }}>No newsletters sent yet</p></div>}
          {history.map((item) => (
            <div key={item.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.subject}</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{item.subscriber_count} subs &middot; {new Date(item.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
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
