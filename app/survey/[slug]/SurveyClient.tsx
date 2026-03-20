'use client';

import { useState, useRef, useCallback } from 'react';
import type { Survey, SurveyQuestion, SurveyAnswers } from '@/types/survey';

// ── Ascentor logo SVG ──────────────────────────────────────────
function AscentorMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} viewBox="0 0 134.34 101.16" xmlns="http://www.w3.org/2000/svg">
      <path fill="#E8A020" d="M105.19,71.38H57l-2.73,6.11h53.63ZM83.83,23.62H78.37L58.82,67.39h44.59Zm-2.7,16.32,7.93,18.63H73.19Z"/>
      <polygon fill="#E8A020" points="74.64 23.64 55.14 67.39 53.36 71.38 50.62 77.54 44.92 77.54 47.66 71.38 49.44 67.39 68.95 23.64 74.64 23.64"/>
      <polygon fill="#E8A020" points="65.42 23.64 41.39 77.54 35.69 77.54 59.72 23.64 65.42 23.64"/>
      <polygon fill="#E8A020" points="56.12 23.64 36.61 67.39 34.83 71.38 32.09 77.54 26.39 77.54 29.14 71.38 30.92 67.39 50.42 23.64 56.12 23.64"/>
    </svg>
  );
}

// ── Check icon ─────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <polyline points="2 6 5 9 10 3" stroke="var(--dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Individual question renderer ───────────────────────────────
function QuestionCard({
  question,
  index,
  total,
  answer,
  customOptions,
  onChange,
  onCustomAdd,
  error,
}: {
  question: SurveyQuestion;
  index: number;
  total: number;
  answer: string | string[] | number | undefined;
  customOptions: string[];
  onChange: (val: string | string[] | number) => void;
  onCustomAdd: (val: string) => void;
  error: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const allOptions = [...(question.options ?? []), ...customOptions];

  function handleOptionClick(opt: string) {
    if (question.type === 'radio') {
      onChange(opt);
    } else {
      const current = Array.isArray(answer) ? answer : [];
      if (current.includes(opt)) {
        onChange(current.filter((v) => v !== opt));
      } else {
        onChange([...current, opt]);
      }
    }
  }

  function isSelected(opt: string) {
    if (question.type === 'radio') return answer === opt;
    return Array.isArray(answer) && answer.includes(opt);
  }

  function handleCustomAdd() {
    const val = customInput.trim();
    if (!val) return;
    onCustomAdd(val);
    setCustomInput('');
    setCustomOpen(false);
    // Auto-select
    if (question.type === 'radio') {
      onChange(val);
    } else {
      const current = Array.isArray(answer) ? answer : [];
      onChange([...current, val]);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: '12px',
    padding: '32px',
    marginBottom: '20px',
    animation: 'cardIn 0.35s ease-out both',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={cardStyle}>
      <style>{`
        @keyframes cardIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        .opt-btn { display:flex; align-items:center; gap:12px; padding:13px 16px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; color:var(--text-muted); font-family:var(--font-ui); font-size:14px; cursor:pointer; text-align:left; width:100%; transition:all 0.15s; }
        .opt-btn:hover { border-color:var(--gold-border); color:var(--text); background:rgba(232,160,32,0.04); }
        .opt-btn.sel { border-color:var(--gold); color:var(--text); background:var(--gold-muted); }
        .scale-btn { flex:1; aspect-ratio:1; max-width:52px; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; color:var(--text-dim); font-family:var(--font-mono); font-size:13px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center; }
        .scale-btn:hover { border-color:var(--gold-border); color:var(--text); }
        .scale-btn.sel { background:var(--gold); border-color:var(--gold); color:var(--dark); font-weight:700; }
      `}</style>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '10px' }}>
        Question {index + 1} of {total}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', marginBottom: '6px' }}>
        {question.text}
      </div>
      {question.hint && (
        <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: 1.5 }}>
          {question.hint}
        </div>
      )}

      {/* Choice questions */}
      {(question.type === 'radio' || question.type === 'checkbox') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allOptions.map((opt) => (
            <button
              key={opt}
              className={`opt-btn${isSelected(opt) ? ' sel' : ''}`}
              onClick={() => handleOptionClick(opt)}
              type="button"
            >
              <div style={{
                width: '18px', height: '18px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected(opt) ? 'var(--gold)' : 'transparent',
                border: `1.5px solid ${isSelected(opt) ? 'var(--gold)' : 'var(--dark-500)'}`,
                borderRadius: question.type === 'radio' ? '50%' : '4px',
                transition: 'all 0.15s',
              }}>
                {isSelected(opt) && <CheckIcon />}
              </div>
              <span>{opt}</span>
            </button>
          ))}

          {question.allowCustom && (
            <div style={{ marginTop: '4px' }}>
              {!customOpen ? (
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'none', border: '1px dashed var(--dark-500)', borderRadius: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer', width: '100%', transition: 'all 0.15s' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add your own answer
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    autoFocus
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
                    placeholder="Type your answer..."
                    style={{ flex: 1, padding: '11px 14px', background: 'var(--bg-input)', border: '1px solid var(--gold-border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: '14px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleCustomAdd}
                    style={{ padding: '0 16px', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', borderRadius: '8px', color: 'var(--gold)', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scale */}
      {question.type === 'scale' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`scale-btn${answer === n ? ' sel' : ''}`}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
            <span>Not at all</span>
            <span>Completely</span>
          </div>
        </div>
      )}

      {/* Textarea */}
      {question.type === 'textarea' && (
        <textarea
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? 'Share your thoughts...'}
          rows={4}
          style={{ width: '100%', padding: '14px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.65, resize: 'vertical', outline: 'none' }}
        />
      )}

      {/* Text */}
      {question.type === 'text' && (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? ''}
          style={{ width: '100%', padding: '13px 16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: '14px', outline: 'none' }}
        />
      )}

      {error && (
        <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
          This question is required.
        </p>
      )}
    </div>
  );
}

// ── Main survey component ──────────────────────────────────────
export default function SurveyClient({ survey }: { survey: Survey }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [customOptions, setCustomOptions] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startTime = useRef(Date.now());

  const questions = survey.questions;
  const q = questions[currentQ];
  const progress = Math.round(((currentQ + 1) / questions.length) * 100);
  const isLast = currentQ === questions.length - 1;

  const setAnswer = useCallback((qid: string, val: string | string[] | number) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
    setErrors((prev) => ({ ...prev, [qid]: false }));
  }, []);

  const addCustomOption = useCallback((qid: string, val: string) => {
    setCustomOptions((prev) => ({ ...prev, [qid]: [...(prev[qid] ?? []), val] }));
  }, []);

  function validate(question: SurveyQuestion): boolean {
    if (!question.required) return true;
    const ans = answers[question.id];
    if (ans === undefined || ans === null || ans === '') return false;
    if (Array.isArray(ans) && ans.length === 0) return false;
    return true;
  }

  async function handleNext() {
    if (!validate(q)) {
      setErrors((prev) => ({ ...prev, [q.id]: true }));
      return;
    }
    if (!isLast) {
      setCurrentQ((n) => n + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Submit
    setSubmitting(true);
    const duration = Math.round((Date.now() - startTime.current) / 1000);
    try {
      await fetch(`/api/survey/${survey.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, metadata: { duration_seconds: duration } }),
      });
    } catch { /* swallow — still show thank you */ }
    setSubmitting(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Thank you screen ──
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '72px', height: '72px', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AscentorMark size={36} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,7vw,52px)', fontWeight: 700, lineHeight: 1.1, color: 'var(--text)' }}>
            Thank <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>you.</span>
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Your response has been recorded. We read every single one — and this directly informs how we build Ascentor for you next.
          </p>
        </div>
      </div>
    );
  }

  // ── Survey ──
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Progress bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--dark)', borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ flex: 1, height: '3px', background: 'var(--dark-600)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--gold-600), var(--gold))', borderRadius: '99px', transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {currentQ + 1} / {questions.length}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 20px 80px' }}>
        {/* Header */}
        <div style={{ padding: '44px 0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AscentorMark size={52} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ascentor
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--gold-muted)', border: '1px solid var(--gold-border)', padding: '5px 12px', borderRadius: '2px' }}>
            {survey.title}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,6vw,48px)', fontWeight: 700, lineHeight: 1.1, color: 'var(--text)' }}>
            {(() => {
    const words = survey.title.trim().split(' ');
    const last = words.pop();
    return <>{words.join(' ')}{' '}<span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>{last}</span></>;
  })()}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '460px', lineHeight: 1.65 }}>
            {survey.description ?? 'This takes about 5 minutes. Your answers shape everything we build next.'}
          </p>
        </div>

        {/* Current question */}
        <QuestionCard
          question={q}
          index={currentQ}
          total={questions.length}
          answer={answers[q.id]}
          customOptions={customOptions[q.id] ?? []}
          onChange={(val) => setAnswer(q.id, val)}
          onCustomAdd={(val) => addCustomOption(q.id, val)}
          error={!!errors[q.id]}
        />

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '12px' }}>
          <button
            onClick={() => { setCurrentQ((n) => n - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentQ === 0}
            style={{ padding: '12px 22px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500, cursor: currentQ === 0 ? 'default' : 'pointer', opacity: currentQ === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={submitting}
            style={{ padding: '13px 28px', background: 'var(--gold)', border: 'none', borderRadius: '8px', color: 'var(--dark)', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          >
            {submitting ? 'Submitting...' : isLast ? 'Submit Survey' : 'Continue'}
            {!submitting && (
              isLast
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
