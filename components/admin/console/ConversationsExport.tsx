'use client';

// The export dialog from the admin prototype. Downloads straight away (the prototype's emailed link is not used, email is not reliable yet).
import { useState } from 'react';
import { FORMATS, RANGES, type FormatLabel, type RangeLabel, type ScopeKind, type TabKey } from '@/lib/admin/conversations-meta';

export interface ScopeChoice { label: string; scope: ScopeKind; tab?: TabKey }
export interface ExportChoice { scope: ScopeChoice; format: FormatLabel; range: RangeLabel; attach: boolean; meta: boolean; anon: boolean }

interface Props {
  title: string;
  scopes: ScopeChoice[];
  defaultRange?: RangeLabel;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onRun: (c: ExportChoice) => void;
}

export default function ConversationsExport({ title, scopes, defaultRange = 'Last 30 days', busy, error, onCancel, onRun }: Props) {
  const [format, setFormat] = useState<FormatLabel>('CSV');
  const [scopeI, setScopeI] = useState(0);
  const [range, setRange] = useState<RangeLabel>(defaultRange);
  const [attach, setAttach] = useState(true);
  const [meta, setMeta] = useState(true);
  const [anon, setAnon] = useState(true);

  const Opt = ({ on, label, pick, disabled }: { on: boolean; label: string; pick?: () => void; disabled?: boolean }) => (
    <button type="button" className={`opt${on ? ' on' : ''}`} aria-pressed={on} onClick={pick} disabled={disabled} style={disabled ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>{label}</button>
  );
  const Tog = ({ on, label, flip }: { on: boolean; label: string; flip: () => void }) => (
    <div className="setrow"><span>{label}</span><button type="button" className={`toggle${on ? ' on' : ''}`} aria-pressed={on} aria-label={label} onClick={flip} /></div>
  );

  return (
    <>
      <button type="button" className="scrim modalscrim" aria-label="Cancel" onClick={busy ? undefined : onCancel} style={{ border: 0 }} />
      <div className="modal" role="dialog" aria-label="Export">
        <p className="h2">Export {title}</p>
        <div className="fld"><label>Format</label><div className="opts">{FORMATS.map((f) => <Opt key={f} on={format === f} label={f} pick={() => setFormat(f)} />)}</div></div>
        <div className="fld"><label>What to include</label><div className="opts">{scopes.map((s, i) => <Opt key={s.label} on={scopeI === i} label={s.label} pick={() => setScopeI(i)} />)}</div></div>
        <div className="fld"><label>Time</label><div className="opts">{RANGES.map((r) => <Opt key={r} on={range === r} label={r} pick={() => setRange(r)} />)}</div></div>
        <Tog on={attach} label="Include photos and voice notes" flip={() => setAttach(!attach)} />
        <p className="sm p">Photos and voice notes are included as links, not as files.</p>
        <Tog on={meta} label="Include times, IDs and read receipts" flip={() => setMeta(!meta)} />
        <p className="sm p">Read receipts are not recorded yet, so they are not in the file.</p>
        <div className="fld"><label>Repeat this export</label><div className="opts"><Opt on label="Off" /><Opt on={false} label="Every week" disabled /><Opt on={false} label="Every month" disabled /></div><p className="sm p">Scheduled exports are not set up yet.</p></div>
        <p className="sm p">The file downloads as soon as it is ready. An export stops at 20,000 messages and says so inside the file.</p>
        <Tog on={anon} label="Replace member names with IDs" flip={() => setAnon(!anon)} />
        <p className="sm p">The export is recorded in the audit log with your name.</p>
        {error && <p className="sm" role="alert" style={{ color: 'var(--err)' }}>{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn bs" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn bp" disabled={busy} onClick={() => onRun({ scope: scopes[scopeI], format, range, attach, meta, anon })}>{busy ? 'Preparing...' : `Export ${format.split(' ')[0]}`}</button>
        </div>
      </div>
    </>
  );
}
