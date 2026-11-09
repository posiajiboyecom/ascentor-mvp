'use client';

// Team and access, built to the admin prototype. All rules live on the server (app/admin/c/team/actions.ts): this only draws them.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AREAS, LEVELS, LEVEL_GUIDE, NAV, type Level, type RoleDef } from '@/lib/admin/areas';
import { setViewAs } from '@/app/admin/c/actions';
import { changeTeammateRole, createTeamRole, inviteTeammate, setLevelForRole, type TeamResult } from '@/app/admin/c/team/actions';

interface StaffRow { id: string; name: string; email: string; roleId: string; roleName: string; lastActive: string; isSelf: boolean }

export default function TeamScreen({ team, roles: initialRoles, canEdit, isAdmin }: { team: StaffRow[]; roles: RoleDef[]; canEdit: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [rows, setRows] = useState(team);
  const [editRole, setEditRole] = useState(() => (initialRoles.find((r) => r.id === 'community') ? 'community' : initialRoles.find((r) => !r.locked)?.id ?? initialRoles[0]?.id));
  const [toast, setToast] = useState('');
  const [panel, setPanel] = useState<null | 'role' | 'invite'>(null);
  const [roleName, setRoleName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(() => initialRoles.find((r) => r.id === 'moderator')?.id ?? initialRoles.find((r) => !r.locked)?.id ?? '');
  const [busy, startBusy] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { setRoles(initialRoles); setRows(team); }, [initialRoles, team]);

  const nAreas = AREAS.length;
  const areasFor = (rid: string) => {
    if (rid === 'admin' || rid === 'owner') return `All ${nAreas} areas`;
    const lv = roles.find((r) => r.id === rid)?.levels ?? {};
    return `${Object.keys(lv).filter((k) => lv[k] !== 'none').length} of ${nAreas} areas`;
  };
  const roleOf = roles.find((r) => r.id === editRole) ?? roles[0];
  const assignable = roles.filter((r) => isAdmin || r.id !== 'admin');

  const run = (p: Promise<TeamResult>, onOk?: (r: TeamResult) => void) => {
    startBusy(async () => {
      try {
        const r = await p;
        if (!r.ok) { flash(r.error || 'That did not work.'); return; }
        onOk?.(r);
        if (r.message) flash(r.message);
        router.refresh();
      } catch { flash('That did not work. Please try again.'); }
    });
  };

  const onRole = (m: StaffRow, roleId: string) => {
    run(changeTeammateRole(m.id, roleId), () => setRows((rs) => rs.map((x) => (x.id === m.id ? { ...x, roleId, roleName: roles.find((r) => r.id === roleId)?.name ?? roleId } : x))));
  };

  const pick = (areaKey: string, level: Level) => {
    if (!canEdit) { flash('Your role can’t change access.'); return; }
    if (!roleOf) return;
    const rid = roleOf.id;
    run(setLevelForRole(rid, areaKey, level), () => setRoles((rs) => rs.map((r) => {
      if (r.id !== rid) return r;
      const levels = { ...r.levels };
      if (level === 'none') delete levels[areaKey]; else levels[areaKey] = level;
      return { ...r, levels };
    })));
  };

  const viewAs = (m: StaffRow) => {
    startBusy(async () => { await setViewAs(m.id); router.push('/admin'); router.refresh(); });
  };

  const submitRole = () => run(createTeamRole(roleName), (r) => { setPanel(null); setRoleName(''); if (r.id) setEditRole(r.id); });
  const submitInvite = () => run(inviteTeammate(email, inviteRole), () => { setPanel(null); setEmail(''); });

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">People</p><h1 className="pt">Team and access</h1><span className="ul" /></div>
          {canEdit && (
            <div className="row">
              <button type="button" className="btn bs" onClick={() => setPanel(panel === 'role' ? null : 'role')}>New role</button>
              <button type="button" className="btn bp" onClick={() => setPanel(panel === 'invite' ? null : 'invite')}>Invite a teammate</button>
            </div>
          )}
        </div>
        <p className="p" style={{ maxWidth: 820 }}>Every teammate has one role. A role lists the parts of the admin they can open. Anything set to <b>No access</b> is hidden completely: it isn’t in their menu, search, Overview or exports, and the server refuses it too.</p>

        {canEdit && panel === 'role' && (
          <div className="card st8">
            <p className="h3">New role</p>
            <p className="sm p">A new role starts with no access. Choose what it can open in the list below.</p>
            <div className="row nw">
              <input className="in" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name, for example Support" aria-label="Role name" maxLength={40} />
              <button type="button" className="btn bp" disabled={busy || roleName.trim().length < 2} onClick={submitRole}>Create role</button>
            </div>
          </div>
        )}
        {canEdit && panel === 'invite' && (
          <div className="card st8">
            <p className="h3">Invite a teammate</p>
            <p className="sm p">They need an Ascentor account already. Enter the email they signed up with and choose a role. We don’t create accounts or send emails from here.</p>
            <div className="row nw">
              <input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Teammate email" />
              <select className="in" style={{ width: 220 }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Role">
                {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button type="button" className="btn bp" disabled={busy || !email.trim()} onClick={submitInvite}>Give access</button>
            </div>
          </div>
        )}

        <div className="kpis">
          {LEVEL_GUIDE.map(([name, what]) => <div key={name} className="card kpi"><span className="k">{name}</span><span className="p" style={{ fontSize: 14 }}>{what}</span></div>)}
        </div>

        {!canEdit && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Granting or changing staff access is limited to one account.</p></div>}

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Teammate</th><th>Email</th><th>Role</th><th>Can open</th><th>Last active</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => {
                const locked = !canEdit || m.isSelf || m.roleId === 'owner' || (m.roleId === 'admin' && !isAdmin);
                return (
                  <tr key={m.id}>
                    <td><span className="num">{m.name}</span></td>
                    <td>{m.email || '-'}</td>
                    <td>
                      {locked
                        ? <span className="tag"><i />{m.roleName}</span>
                        : (
                          <select className="in" style={{ minHeight: 36, width: 190 }} value={m.roleId} aria-label={`Role for ${m.name}`} disabled={busy} onChange={(e) => onRole(m, e.target.value)}>
                            {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        )}
                    </td>
                    <td>{areasFor(m.roleId)}</td>
                    <td>{m.lastActive}</td>
                    <td style={{ textAlign: 'right' }}>{isAdmin && !m.isSelf && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={() => viewAs(m)}>View as</button>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6}><span className="sm">No teammates yet.</span></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card st">
          <div className="sb" style={{ flexWrap: 'wrap' }}>
            <p className="h3">What each role can open</p>
            <div className="opts" role="group" aria-label="Role">
              {roles.map((r) => <button key={r.id} type="button" className={`opt${r.id === roleOf?.id ? ' on' : ''}`} aria-pressed={r.id === roleOf?.id} onClick={() => setEditRole(r.id)}>{r.name}</button>)}
            </div>
          </div>
          {roleOf && (roleOf.id === 'admin' || roleOf.locked) ? (
            <div className="rz"><p className="p sm" style={{ color: 'var(--text)' }}>Admins have full access to everything, including team and access. This can’t be changed.</p></div>
          ) : roleOf ? (
            <>
              <p className="sm p">{roleOf.name} can open {areasFor(roleOf.id)}.</p>
              {NAV.map(([group, items]) => (
                <div key={group} className="st8" style={{ paddingTop: 6 }}>
                  <p className="sgh" style={{ padding: 0 }}>{group}</p>
                  {items.map(([key, label]) => {
                    const cur = roleOf.levels[key] ?? 'none';
                    return (
                      <div key={key} className="sb" style={{ minHeight: 44, borderBottom: '1px solid var(--border)' }}>
                        <span>{label}</span>
                        <div className="seg3" role="group" aria-label={`${roleOf.name}: ${label}`}>
                          {LEVELS.map(([lk, ll]) => (
                            <button key={lk} type="button" disabled={busy} className={`${cur === lk ? 'on' : ''}${lk === 'none' ? ' none' : ''}`} aria-pressed={cur === lk} onClick={() => { if (cur !== lk) pick(key, lk); }}>{ll}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
