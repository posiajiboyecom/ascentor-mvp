'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Survey, SurveyQuestion, QuestionType, SurveyAnalysis } from '@/types/survey';

// ── Logo ──────────────────────────────────────────────────────
function AscentorMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} viewBox="0 0 134.34 101.16" xmlns="http://www.w3.org/2000/svg">
      <path fill="#E8A020" d="M105.19,71.38H57l-2.73,6.11h53.63ZM83.83,23.62H78.37L58.82,67.39h44.59Zm-2.7,16.32,7.93,18.63H73.19Z"/>
      <polygon fill="#E8A020" points="74.64 23.64 55.14 67.39 53.36 71.38 50.62 77.54 44.92 77.54 47.66 71.38 49.44 67.39 68.95 23.64 74.64 23.64"/>
      <polygon fill="#E8A020" points="65.42 23.64 41.39 77.54 35.69 77.54 59.72 23.64 65.42 23.64"/>
      <polygon fill="#E8A020" points="56.12 23.64 36.61 67.39 34.83 71.38 32.09 77.54 26.39 77.54 29.14 71.38 30.92 67.39 50.42 23.64 56.12 23.64"/>
    </svg>
  );
}

type AdminTab = 'builder' | 'responses';
type SurveyWithCount = Survey & { response_count?: number };

// ── Helpers ───────────────────────────────────────────────────
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const TYPE_LABELS: Record<QuestionType, string> = {
  radio: 'Single choice',
  checkbox: 'Multi select',
  scale: '1–10 Scale',
  textarea: 'Open text',
  text: 'Short text',
};

// ── Question builder form ─────────────────────────────────────
function QuestionForm({
  onAdd,
}: {
  onAdd: (q: Omit<SurveyQuestion, 'id'>) => void;
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('radio');
  const [hint, setHint] = useState('');
  const [required, setRequired] = useState(true);
  const [allowCustom, setAllowCustom] = useState(true);
  const [options, setOptions] = useState<string[]>([]);
  const [optInput, setOptInput] = useState('');

  const showOptions = type === 'radio' || type === 'checkbox';

  function addOpt() {
    const v = optInput.trim();
    if (!v) return;
    setOptions((o) => [...o, v]);
    setOptInput('');
  }

  function removeOpt(i: number) {
    setOptions((o) => o.filter((_, j) => j !== i));
  }

  function handleAdd() {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), type, hint: hint.trim() || undefined, required, allowCustom, options });
    setText(''); setHint(''); setOptions([]); setRequired(true); setAllowCustom(true);
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: '13px', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px', position: 'sticky', top: '20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '18px' }}>Add Question</div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Question text</label>
        <input style={inputStyle} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. What is your biggest career challenge?" />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Type</label>
        <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }} value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {showOptions && (
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Options</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '6px' }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>{opt}</span>
                <button onClick={() => removeOpt(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 0, padding: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              style={{ ...inputStyle, flex: 1, fontSize: '12px', padding: '8px 10px' }}
              value={optInput}
              onChange={(e) => setOptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addOpt()}
              placeholder="Add an option..."
            />
            <button onClick={addOpt} style={{ padding: '7px 12px', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', borderRadius: '6px', color: 'var(--gold)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Add</button>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <input type="checkbox" id="acb" checked={allowCustom} onChange={(e) => setAllowCustom(e.target.checked)} style={{ accentColor: 'var(--gold)', width: '13px', height: '13px' }} />
            <label htmlFor="acb" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>Allow custom answer</label>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Hint text (optional)</label>
        <input style={inputStyle} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. Select all that apply" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '16px' }}>
        <input type="checkbox" id="reqcb" checked={required} onChange={(e) => setRequired(e.target.checked)} style={{ accentColor: 'var(--gold)', width: '13px', height: '13px' }} />
        <label htmlFor="reqcb" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>Required</label>
      </div>

      <button
        onClick={handleAdd}
        style={{ width: '100%', padding: '12px', background: 'var(--gold)', border: 'none', borderRadius: '8px', color: 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
      >
        Add to Survey
      </button>
    </div>
  );
}

// ── Analysis panel ────────────────────────────────────────────
function AnalysisPanel({ surveyId }: { surveyId: string }) {
  const [analysis, setAnalysis] = useState<SurveyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadAnalysis();
  }, [surveyId]);

  async function loadAnalysis() {
    setLoading(true);
    const { data } = await supabase
      .from('survey_analyses')
      .select('*')
      .eq('survey_id', surveyId)
      .single();
    setAnalysis(data as SurveyAnalysis | null);
    setLoading(false);
  }

  async function runAnalysis() {
    setRunning(true);
    const res = await fetch(`/api/admin/surveys/${surveyId}/analyse`, { method: 'POST' });
    if (res.ok) await loadAnalysis();
    setRunning(false);
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Loading analysis...</div>;

  const ins = analysis?.insights;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          onClick={runAnalysis}
          disabled={running}
          style={{ padding: '10px 20px', background: running ? 'var(--dark-600)' : 'var(--gold)', border: 'none', borderRadius: '8px', color: running ? 'var(--text-dim)' : 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, cursor: running ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          {running ? 'Analysing...' : analysis ? 'Re-run Analysis' : 'Run AI Analysis'}
        </button>
      </div>

      {!ins && (
        <div style={{ padding: '60px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>No analysis yet. Run AI analysis to get insights from responses.</p>
        </div>
      )}

      {ins && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Responses', value: ins.total_responses },
              { label: 'Willing to Pay', value: `${ins.willingness_to_pay_pct}%` },
              { label: 'Avg Duration', value: `${Math.round(ins.avg_duration_seconds / 60)}m` },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 700, color: 'var(--gold)', lineHeight: 1, marginBottom: '4px' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          <div style={{ background: 'linear-gradient(135deg, rgba(232,160,32,0.06), rgba(139,92,246,0.04))', border: '1px solid var(--gold-border)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', padding: '3px 8px', borderRadius: '2px' }}>AI Analysis</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Key signals from your members</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ins.key_insights.map((insight, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0, marginTop: '5px' }} />
                  <span><strong style={{ color: 'var(--text)' }}>{insight.headline}</strong> — {insight.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-question charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {ins.per_question.map((pq) => (
              <div key={pq.question_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{pq.question_text}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>{TYPE_LABELS[pq.type]}</span>
                </div>
                <div style={{ padding: '18px' }}>
                  {pq.distribution && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pq.distribution.map((d) => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '180px', flexShrink: 0 }}>{d.label}</div>
                          <div style={{ flex: 1, height: '7px', background: 'var(--dark-600)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg, var(--gold-600), var(--gold))', borderRadius: '99px', transition: 'width 1s ease' }} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', minWidth: '32px', textAlign: 'right' }}>{d.pct}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pq.average !== undefined && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, color: 'var(--gold)', marginBottom: '8px' }}>{pq.average}<span style={{ fontSize: '16px', color: 'var(--text-dim)' }}>/10</span></div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(pq.distribution_1_10 ?? []).map((count, i) => {
                          const max = Math.max(...(pq.distribution_1_10 ?? [1]));
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '100%', height: `${Math.max(4, (count / max) * 40)}px`, background: 'var(--gold)', opacity: 0.4 + (i / 10) * 0.6, borderRadius: '2px 2px 0 0' }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)' }}>{i + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {pq.sample_responses && pq.sample_responses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pq.sample_responses.map((r, i) => (
                        <div key={i} style={{ padding: '11px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic', borderLeft: '3px solid var(--gold-border)' }}>
                          {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main admin component ───────────────────────────────────────
export default function AdminSurveysInner() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<SurveyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('builder');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadSurveys(); }, []);

  async function loadSurveys() {
    setLoading(true);
    const { data } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get response counts
      const withCounts = await Promise.all(
        data.map(async (s) => {
          const { count } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('survey_id', s.id);
          return { ...s, response_count: count ?? 0 };
        })
      );
      setSurveys(withCounts as SurveyWithCount[]);
      // Use functional update to read current state without stale closure
      setActiveSurveyId(currentId => {
        if (!currentId && withCounts.length > 0) {
          const first = withCounts[0] as Survey;
          setQuestions(first.questions ?? []);
          setSurveyTitle(first.title);
          setSurveyDesc(first.description ?? '');
          return first.id;
        }
        return currentId;
      });
    }
    setLoading(false);
  }

  function openSurvey(s: Survey) {
    setActiveSurveyId(s.id);
    setQuestions(s.questions);
    setSurveyTitle(s.title);
    setSurveyDesc(s.description ?? '');
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function addQuestion(q: Omit<SurveyQuestion, 'id'>) {
    setQuestions((prev) => [...prev, { ...q, id: `q_${Date.now()}` }]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  async function saveSurvey() {
    if (!activeSurveyId || !surveyTitle.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/surveys/${activeSurveyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: surveyTitle, description: surveyDesc, questions }),
    });
    await loadSurveys();
    setSaving(false);
    showToast('Survey saved');
  }

  async function togglePublish() {
    if (!activeSurveyId) return;
    const current = surveys.find((s) => s.id === activeSurveyId);
    if (!current) return;
    setPublishing(true);
    await fetch(`/api/admin/surveys/${activeSurveyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current.is_published }),
    });
    await loadSurveys();
    setPublishing(false);
    showToast(current.is_published ? 'Survey unpublished' : 'Survey published');
  }

  async async function createNewSurvey() {
    const title = 'New Survey';
    const slug = `survey-${Date.now()}`;
    const res = await fetch('/api/admin/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, questions: [] }),
    });
    if (res.ok) {
      const created = await res.json();
      await loadSurveys();
      setActiveSurveyId(created.id);
      setSurveyTitle(created.title);
      setSurveyDesc(created.description ?? '');
      setQuestions(created.questions ?? []);
      showToast('New survey created');
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error ?? 'Failed to create survey — check admin permissions');
    }
  }

  const activeSurvey = surveys.find((s) => s.id === activeSurveyId);

  const s: Record<string, React.CSSProperties> = {
    page: { padding: '0' },
    topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', gap: '14px', flexWrap: 'wrap' as const },
    tabs: { display: 'flex', gap: '4px', background: 'var(--dark-800)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' },
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '8px 18px', background: active ? 'var(--bg-card)' : 'none', border: active ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', color: active ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' });

  if (loading) return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Loading surveys...</div>;

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'var(--dark-700)', border: '1px solid var(--gold-border)', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-mono)', zIndex: 9999, letterSpacing: '0.04em' }}>
          {toast}
        </div>
      )}

      {/* Page header */}
      <div style={s.topBar}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Surveys</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Build surveys, collect responses, auto-analyse with AI.</p>
        </div>
        <button
          onClick={createNewSurvey}
          style={{ padding: '10px 20px', background: 'var(--gold)', border: 'none', borderRadius: '8px', color: 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Survey
        </button>
      </div>

      {/* Survey selector */}
      {surveys.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' as const }}>
          {surveys.map((s) => (
            <button
              key={s.id}
              onClick={() => openSurvey(s)}
              style={{ padding: '8px 16px', background: activeSurveyId === s.id ? 'var(--gold-muted)' : 'var(--bg-card)', border: `1px solid ${activeSurveyId === s.id ? 'var(--gold-border)' : 'var(--border)'}`, borderRadius: '8px', color: activeSurveyId === s.id ? 'var(--gold)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {s.title}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>{s.response_count} resp.</span>
              {s.is_published && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}

      {activeSurvey && (
        <>
          {/* Survey meta + actions */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text)', background: 'none', border: 'none', outline: 'none', width: '100%' }}
                placeholder="Survey title..."
              />
              <input
                value={surveyDesc}
                onChange={(e) => setSurveyDesc(e.target.value)}
                style={{ fontSize: '13px', color: 'var(--text-dim)', background: 'none', border: 'none', outline: 'none', width: '100%', fontFamily: 'var(--font-ui)' }}
                placeholder="Short description..."
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <a
                href={`/survey/${activeSurvey.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Preview
              </a>
              <button onClick={saveSurvey} disabled={saving} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={togglePublish}
                disabled={publishing}
                style={{ padding: '9px 16px', background: activeSurvey.is_published ? 'rgba(239,68,68,0.1)' : 'var(--gold)', border: `1px solid ${activeSurvey.is_published ? 'rgba(239,68,68,0.3)' : 'transparent'}`, borderRadius: '8px', color: activeSurvey.is_published ? 'var(--error)' : 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {activeSurvey.is_published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={s.tabs}>
              <button style={tabBtn(tab === 'builder')} onClick={() => setTab('builder')}>Builder</button>
<button style={tabBtn(tab === 'responses')} onClick={() => setTab('responses')}>
                Responses & Analysis
                {(activeSurvey.response_count ?? 0) > 0 && (
                  <span style={{ marginLeft: '6px', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: '999px' }}>
                    {activeSurvey.response_count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Builder tab */}
          {tab === 'builder' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '22px', alignItems: 'start' }}>
              <div>
                {questions.length === 0 && (
                  <div style={{ padding: '48px', textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-dim)', fontSize: '14px' }}>
                    No questions yet. Add your first question using the panel on the right.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {questions.map((q, i) => (
                    <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'border-color 0.15s' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)', minWidth: '20px', paddingTop: '2px' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>{q.text}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {TYPE_LABELS[q.type]} · {q.required ? 'required' : 'optional'}
                          {q.options && q.options.length > 0 ? ` · ${q.options.length} options` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { dir: -1 as const, title: 'Up', icon: <polyline points="18 15 12 9 6 15"/> },
                          { dir: 1 as const, title: 'Down', icon: <polyline points="6 9 12 15 18 9"/> },
                        ].map(({ dir, title, icon }) => (
                          <button key={title} title={title} onClick={() => moveQuestion(q.id, dir)} style={{ width: '28px', height: '28px', background: 'none', border: '1px solid transparent', borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
                          </button>
                        ))}
                        <button onClick={() => removeQuestion(q.id)} title="Delete" style={{ width: '28px', height: '28px', background: 'none', border: '1px solid transparent', borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <QuestionForm onAdd={addQuestion} />
            </div>
          )}

          {/* Responses tab */}
          {tab === 'responses' && <AnalysisPanel surveyId={activeSurveyId!} />}
        </>
      )}

      {surveys.length === 0 && !loading && (
        <div style={{ padding: '80px', textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <AscentorMark size={40} />
          <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-dim)' }}>No surveys yet. Create your first survey to get started.</p>
        </div>
      )}
    </div>
  );
}
