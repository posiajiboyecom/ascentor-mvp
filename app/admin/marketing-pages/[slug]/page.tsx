'use client';

// app/admin/marketing-pages/[slug]/page.tsx — THE LEDGER
// Single-page editor: lists all sections for one marketing page,
// expandable to edit draft content, with per-section Publish/
// Unpublish. Repeating sections (FAQ, personas, etc.) get an
// item list with add/edit/delete.
//
// SECTION TYPE -> EDITOR MAPPING:
//   'prose'      -> single textarea, draft_data = { content: string }
//   'structured' -> one input per key already present in draft_data
//                   (or published_data if draft is empty) — keys are
//                   NOT hardcoded here, so this same editor works for
//                   a hero section with {headline, subhead, cta_label,
//                   cta_href} or any other structured shape a future
//                   section needs, without code changes. New keys are
//                   addable via the "+ Add field" control.
//   'repeating'  -> item list, each item edited via the same
//                   key-value field editor as 'structured', since
//                   repeating items have the same "open-ended JSON
//                   object" shape problem (FAQ = {q,a}, personas =
//                   {stage,emoji,color,...} — confirmed different
//                   shapes during schema design).

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface PageDetail {
  id: string;
  slug: string;
  title: string;
  route: string;
}

interface SectionRow {
  id: string;
  section_key: string;
  label: string;
  section_type: 'prose' | 'repeating' | 'structured';
  sort_order: number;
  draft_data: any;
  published_data: any;
  status: 'draft' | 'published';
  items: ItemRow[];
}

interface ItemRow {
  id: string;
  section_id: string;
  sort_order: number;
  draft_data: any;
  published_data: any;
  status: 'draft' | 'published';
}

// ── Key-value field editor — shared by 'structured' sections and ──
// ── repeating items, since both are open-ended JSON objects.     ──
function FieldEditor({
  data,
  onChange,
}: {
  data: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const entries = Object.entries(data || {});

  function updateField(key: string, value: string) {
    onChange({ ...data, [key]: value });
  }
  function removeField(key: string) {
    const next = { ...data };
    delete next[key];
    onChange(next);
  }
  function addField() {
    const key = newKey.trim();
    if (!key || key in (data || {})) return;
    onChange({ ...(data || {}), [key]: '' });
    setNewKey('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.length === 0 && (
        <p className="ledger-mono" style={{ fontSize: 11.5, opacity: 0.7 }}>No fields yet — add one below.</p>
      )}
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <label className="ledger-label" style={{ width: 140, flexShrink: 0, paddingTop: 9 }}>{key}</label>
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            onChange={e => updateField(key, e.target.value)}
            rows={String(value).length > 80 ? 3 : 1}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)',
              border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)',
              color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-ui)', fontSize: 13, resize: 'vertical',
            }}
          />
          <button onClick={() => removeField(key)} className="ledger-btn ledger-btn-danger" style={{ padding: '8px 10px', fontSize: 10 }}>
            Remove
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addField()}
          placeholder="field name, e.g. headline"
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)',
            border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)',
            color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-mono)', fontSize: 12,
          }}
        />
        <button onClick={addField} className="ledger-btn ledger-btn-ghost" style={{ padding: '8px 14px', fontSize: 11 }}>
          + Add field
        </button>
      </div>
    </div>
  );
}

export default function MarketingPageEditor() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [page, setPage] = useState<PageDetail | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // sectionId or itemId currently saving
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // New-section form state
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState('');
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [newSectionType, setNewSectionType] = useState<'prose' | 'structured' | 'repeating'>('structured');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/marketing-cms?slug=${slug}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load page');
      setPage(data.page);
      setSections(data.sections || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, supabase]);

  useEffect(() => { load(); }, [load]);

  async function callAction(body: Record<string, any>) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/marketing-cms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Action failed');
    return data;
  }

  async function saveSectionDraft(section: SectionRow, draftData: any) {
    setSaving(section.id);
    try {
      await callAction({ action: 'save_section_draft', sectionId: section.id, draftData });
      setSections(prev => prev.map(s => s.id === section.id ? { ...s, draft_data: draftData } : s));
      showToast('Draft saved');
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setSaving(null);
    }
  }

  async function publishSection(section: SectionRow) {
    setSaving(section.id);
    try {
      await callAction({ action: 'publish_section', sectionId: section.id });
      showToast(`"${section.label}" published`);
      load();
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setSaving(null);
    }
  }

  async function unpublishSection(section: SectionRow) {
    if (!confirm(`Unpublish "${section.label}"? The live site will keep showing the last published version until you publish again.`)) return;
    setSaving(section.id);
    try {
      await callAction({ action: 'unpublish_section', sectionId: section.id });
      showToast(`"${section.label}" marked as draft`);
      load();
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setSaving(null);
    }
  }

  async function saveItemDraft(item: ItemRow, draftData: any) {
    setSaving(item.id);
    try {
      await callAction({ action: 'save_item_draft', itemId: item.id, draftData });
      setSections(prev => prev.map(s => ({
        ...s,
        items: s.items.map(i => i.id === item.id ? { ...i, draft_data: draftData } : i),
      })));
      showToast('Item saved');
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setSaving(null);
    }
  }

  async function addItem(section: SectionRow) {
    try {
      await callAction({ action: 'create_item', sectionId: section.id, draftData: {} });
      showToast('Item added — draft');
      load();
    } catch (err: any) {
      showToast(err.message, false);
    }
  }

  async function deleteItem(item: ItemRow) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    try {
      await callAction({ action: 'delete_item', itemId: item.id });
      showToast('Item deleted');
      load();
    } catch (err: any) {
      showToast(err.message, false);
    }
  }

  async function createSection() {
    if (!page || !newSectionKey.trim() || !newSectionLabel.trim()) return;
    try {
      await callAction({
        action: 'create_section',
        pageId: page.id,
        sectionKey: newSectionKey.trim(),
        label: newSectionLabel.trim(),
        sectionType: newSectionType,
      });
      showToast('Section created');
      setShowNewSection(false);
      setNewSectionKey('');
      setNewSectionLabel('');
      load();
    } catch (err: any) {
      showToast(err.message, false);
    }
  }

  if (loading) {
    return (
      <div className="ledger-panel" style={{ padding: 40, textAlign: 'center' }}>
        <p className="ledger-mono">Loading…</p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="ledger-tag ledger-tag-flag" style={{ display: 'block', padding: '14px 18px' }}>
        {error || 'Page not found'}
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div className={`ledger-tag ${toast.ok ? 'ledger-tag-ok' : 'ledger-tag-flag'}`}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '10px 16px', fontSize: 12 }}>
          {toast.msg}
        </div>
      )}

      <Link href="/admin/marketing-pages" className="ledger-mono" style={{ display: 'inline-block', marginBottom: 14, color: 'var(--ledger-gold-deep)', textDecoration: 'none' }}>
        ← All marketing pages
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span className="ledger-eyebrow">{page.route}</span>
          <h1 className="ledger-h1" style={{ fontSize: 28, marginTop: 6 }}>{page.title}</h1>
        </div>
        <button onClick={() => setShowNewSection(v => !v)} className="ledger-btn ledger-btn-ghost">
          {showNewSection ? 'Cancel' : '+ New section'}
        </button>
      </div>

      {showNewSection && (
        <div className="ledger-panel" style={{ padding: 18, marginBottom: 20 }}>
          <h3 className="ledger-h2" style={{ fontSize: 15, marginBottom: 12 }}>New section</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="ledger-label" style={{ display: 'block', marginBottom: 5 }}>Section key</label>
              <input value={newSectionKey} onChange={e => setNewSectionKey(e.target.value)} placeholder="e.g. hero"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)', border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-mono)', fontSize: 12 }} />
            </div>
            <div>
              <label className="ledger-label" style={{ display: 'block', marginBottom: 5 }}>Label</label>
              <input value={newSectionLabel} onChange={e => setNewSectionLabel(e.target.value)} placeholder="e.g. Hero Section"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)', border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-ui)', fontSize: 13 }} />
            </div>
            <div>
              <label className="ledger-label" style={{ display: 'block', marginBottom: 5 }}>Type</label>
              <select value={newSectionType} onChange={e => setNewSectionType(e.target.value as any)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--ledger-radius-sm)', border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-ui)', fontSize: 13 }}>
                <option value="structured">Structured (fields)</option>
                <option value="prose">Prose (single text block)</option>
                <option value="repeating">Repeating (list of items)</option>
              </select>
            </div>
          </div>
          <button onClick={createSection} disabled={!newSectionKey.trim() || !newSectionLabel.trim()} className="ledger-btn ledger-btn-primary">
            Create section
          </button>
        </div>
      )}

      {sections.length === 0 && !showNewSection && (
        <div className="ledger-panel" style={{ padding: 40, textAlign: 'center' }}>
          <p className="ledger-mono" style={{ marginBottom: 10 }}>No sections yet for this page.</p>
          <button onClick={() => setShowNewSection(true)} className="ledger-btn ledger-btn-primary">+ New section</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sections.map(section => {
          const isOpen = expandedSection === section.id;
          const isSaving = saving === section.id;
          const draftContent = section.draft_data || {};

          return (
            <div key={section.id} className="ledger-panel" style={{ overflow: 'hidden' }}>
              <button
                onClick={() => setExpandedSection(isOpen ? null : section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="ledger-h2" style={{ fontSize: 15 }}>{section.label}</span>
                  <span className="ledger-mono" style={{ fontSize: 10 }}>{section.section_key}</span>
                  <span className="ledger-tag" style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink-faint)', fontSize: 8.5 }}>
                    {section.section_type}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`ledger-tag ${section.status === 'published' ? 'ledger-tag-ok' : 'ledger-tag-new'}`}>
                    {section.status === 'published' ? 'Live' : 'Draft'}
                  </span>
                  <span style={{ color: 'var(--ledger-ink-faint)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--ledger-line)' }}>
                  <div style={{ paddingTop: 16 }}>
                    {section.section_type === 'prose' && (
                      <textarea
                        value={draftContent.content || ''}
                        onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, draft_data: { ...draftContent, content: e.target.value } } : s))}
                        rows={8}
                        placeholder="Write the prose content for this section…"
                        style={{
                          width: '100%', padding: '12px 14px', borderRadius: 'var(--ledger-radius-md)',
                          border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)',
                          color: 'var(--ledger-ink)', fontFamily: 'var(--ledger-font-ui)', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical',
                        }}
                      />
                    )}

                    {section.section_type === 'structured' && (
                      <FieldEditor
                        data={draftContent}
                        onChange={next => setSections(prev => prev.map(s => s.id === section.id ? { ...s, draft_data: next } : s))}
                      />
                    )}

                    {section.section_type === 'repeating' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {section.items.length === 0 && (
                          <p className="ledger-mono" style={{ fontSize: 11.5, opacity: 0.7 }}>No items yet.</p>
                        )}
                        {section.items.map((item, idx) => (
                          <div key={item.id} className="ledger-panel" style={{ padding: 14, background: 'var(--ledger-bg-deep)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <span className="ledger-mono" style={{ fontSize: 10 }}>Item {idx + 1}</span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span className={`ledger-tag ${item.status === 'published' ? 'ledger-tag-ok' : 'ledger-tag-new'}`} style={{ fontSize: 8.5 }}>
                                  {item.status === 'published' ? 'Live' : 'Draft'}
                                </span>
                                <button onClick={() => deleteItem(item)} className="ledger-btn ledger-btn-danger" style={{ padding: '3px 9px', fontSize: 9.5 }}>
                                  Delete
                                </button>
                              </div>
                            </div>
                            <FieldEditor
                              data={item.draft_data || {}}
                              onChange={next => setSections(prev => prev.map(s => ({
                                ...s,
                                items: s.items.map(i => i.id === item.id ? { ...i, draft_data: next } : i),
                              })))}
                            />
                            <button
                              onClick={() => saveItemDraft(item, item.draft_data)}
                              disabled={saving === item.id}
                              className="ledger-btn ledger-btn-ghost"
                              style={{ marginTop: 10, fontSize: 10.5 }}
                            >
                              {saving === item.id ? 'Saving…' : 'Save item'}
                            </button>
                          </div>
                        ))}
                        <button onClick={() => addItem(section)} className="ledger-btn ledger-btn-ghost" style={{ alignSelf: 'flex-start' }}>
                          + Add item
                        </button>
                      </div>
                    )}
                  </div>

                  {section.section_type !== 'repeating' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => saveSectionDraft(section, section.draft_data)}
                        disabled={isSaving}
                        className="ledger-btn ledger-btn-ghost"
                      >
                        {isSaving ? 'Saving…' : 'Save draft'}
                      </button>
                      <button
                        onClick={() => publishSection(section)}
                        disabled={isSaving}
                        className="ledger-btn ledger-btn-primary"
                      >
                        Publish
                      </button>
                      {section.status === 'published' && (
                        <button
                          onClick={() => unpublishSection(section)}
                          disabled={isSaving}
                          className="ledger-btn ledger-btn-danger"
                        >
                          Unpublish
                        </button>
                      )}
                    </div>
                  )}

                  {section.section_type === 'repeating' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => publishSection(section)}
                        disabled={isSaving}
                        className="ledger-btn ledger-btn-primary"
                      >
                        {isSaving ? 'Publishing…' : 'Publish section + all items'}
                      </button>
                      {section.status === 'published' && (
                        <button
                          onClick={() => unpublishSection(section)}
                          disabled={isSaving}
                          className="ledger-btn ledger-btn-danger"
                        >
                          Unpublish
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
