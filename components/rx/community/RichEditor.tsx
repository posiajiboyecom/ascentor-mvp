'use client';

// A small rich-text editor for Community posts: bold, italic, underline, one heading size, lists, a quote and links.
// What it produces is cleaned again on the server before it is stored, so nothing here is trusted.

import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Underline as UnderlineIcon, Unlink } from 'lucide-react';

export interface RichEditorProps {
  placeholder?: string;
  onChange: (html: string, text: string) => void;
  /** Changing this key clears the editor (used after posting). */
  resetKey?: number;
}

export default function RichEditor({ placeholder = 'Write something', onChange, resetKey = 0 }: RichEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        code: false, codeBlock: false, horizontalRule: false, strike: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow ugc', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { 'aria-label': 'Post text', 'data-placeholder': placeholder, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML(), e.getText()),
  });

  useEffect(() => { if (editor && resetKey) { editor.commands.clearContent(true); onChange('', ''); } }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return <div className="rx-editor"><div className="rx-editor-body" aria-busy="true" /></div>;

  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={run}>{icon}</button>
  );

  function applyLink() {
    const url = href.trim();
    if (!url) { editor?.chain().focus().unsetLink().run(); setLinkOpen(false); return; }
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor?.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    setHref(''); setLinkOpen(false);
  }

  return (
    <div className="rx-editor">
      <div className="rx-editor-bar" role="toolbar" aria-label="Formatting">
        {btn('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold aria-hidden />)}
        {btn('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic aria-hidden />)}
        {btn('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon aria-hidden />)}
        {btn('Heading', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 aria-hidden />)}
        {btn('Bulleted list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List aria-hidden />)}
        {btn('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered aria-hidden />)}
        {btn('Quote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote aria-hidden />)}
        {btn('Add link', editor.isActive('link') || linkOpen, () => { setHref(editor.getAttributes('link').href ?? ''); setLinkOpen((o) => !o); }, <Link2 aria-hidden />)}
        {editor.isActive('link') && btn('Remove link', false, () => editor.chain().focus().unsetLink().run(), <Unlink aria-hidden />)}
      </div>
      {linkOpen && (
        <div className="rx-row rx-nw" style={{ padding: 8, gap: 8, borderBottom: '1px solid var(--rx-border)', background: 'var(--rx-card)' }}>
          <input className="rx-in" style={{ minHeight: 40 }} placeholder="https://" aria-label="Link address" value={href} onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} />
          <button type="button" className="rx-btn secondary" style={{ minHeight: 40 }} onClick={applyLink}>Add</button>
        </div>
      )}
      <div className="rx-editor-body"><EditorContent editor={editor} /></div>
    </div>
  );
}
