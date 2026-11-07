'use client';

// Reusable email designs: start a campaign from one, edit, or delete.
import { useEffect, useState, useTransition } from 'react';
import { deleteTemplate, listTemplates, type Template } from '@/app/admin/c/newsletter/actions';
import { when, type Ctx } from './EmailConsole';

export default function TemplatesTab({ ctx, onUse, onEdit }: { ctx: Ctx; onUse: (t: Template) => void; onEdit: (t: Template | null) => void }) {
  const [list, setList] = useState<Template[] | null>(null);
  const [busy, start] = useTransition();
  const load = async () => { const r = await listTemplates(); if (r.ok) setList(r.templates); else ctx.flash(r.error, true); };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="st">
      <div className="sb">
        <p className="sm">Save designs you reuse (event invitations, monthly updates, announcements) and start campaigns from them.</p>
        {ctx.canEdit && <button type="button" className="btn bp" onClick={() => onEdit(null)}>New template</button>}
      </div>
      {list === null ? <div className="card empty"><p className="sm">Loading…</p></div>
        : list.length === 0 ? <div className="card empty"><p className="h3">No templates yet</p><p className="sm">Make one here, or use “Save as template” while writing a campaign.</p></div>
        : (
          <div className="tblwrap"><table className="tbl">
            <thead><tr><th>Template</th><th>Subject</th><th>Updated</th><th /></tr></thead>
            <tbody>{list.map((t) => (
              <tr key={t.id}>
                <td><button type="button" className="rowbtn" onClick={() => (ctx.canEdit ? onEdit(t) : onUse(t))}>{t.name}</button></td>
                <td className="sm">{t.subject || '–'}</td>
                <td className="sm">{when(t.updated_at)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {ctx.canEdit && <button type="button" className="lk" onClick={() => onUse(t)}>Use in a campaign</button>}
                  {ctx.canEdit && <button type="button" className="lk" style={{ marginLeft: 12, color: 'var(--err)' }} disabled={busy} onClick={() => start(async () => { if (!window.confirm(`Delete the template “${t.name}”?`)) return; const r = await deleteTemplate(t.id); if (r.ok) { ctx.flash('Template deleted.'); await load(); } else ctx.flash(r.error, true); })}>Delete</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
    </div>
  );
}
