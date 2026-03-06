'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type UserRole,
} from '@/lib/permissions';

// ─────────────────────────────────────────────────────────────────
// /admin/permissions — Root-only
// Lets admin view all moderators and toggle their individual
// permissions. Changes are stored in profiles.permissions (jsonb).
// ─────────────────────────────────────────────────────────────────

const brand = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', monospace",
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.08)',
  goldBorder:  'rgba(232,160,32,0.22)',
  dark:        'var(--admin-bg)',
  dark700:     'var(--admin-bg-card)',
  dark600:     'var(--admin-bg-input)',
  dark500:     'var(--admin-text-faint)',
  dark400:     'var(--admin-text-muted)',
  dark200:     'var(--admin-text)',
  dark50:      '#F7F6F3',
  card:        'var(--admin-bg-deep)',
  border:      'var(--admin-border)',
  teal:        '#14B8A6',
  tealMuted:   'rgba(20,184,166,0.08)',
  tealBorder:  'rgba(20,184,166,0.22)',
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  permissions: Permission[] | null;
};

// Group permissions by their group label
const PERMISSION_GROUPS = Object.entries(PERMISSION_LABELS).reduce<
  Record<string, { key: Permission; label: string; description: string }[]>
>((acc, [key, val]) => {
  if (!acc[val.group]) acc[val.group] = [];
  acc[val.group].push({ key: key as Permission, label: val.label, description: val.description });
  return acc;
}, {});

// Permissions that are genuinely admin-only and should not be grantable to moderators
const ADMIN_ONLY: Permission[] = [
  'admin.manage_permissions',
  'users.edit_role',
  'users.delete',
  'users.export',
  'content.blog.delete',
  'content.courses.delete',
  'content.courses.publish',
  'experts.delete',
  'community.cohorts.delete',
  'newsletter.send',
  'newsletter.manage_subscribers',
  'audit.view_logs',
  'payments.view',
  'payments.refund',
];

export default function PermissionsPage() {
  const supabase = createClient();
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [selected,     setSelected]     = useState<StaffMember | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [currentRole,  setCurrentRole]  = useState<UserRole | null>(null);

  // Working copy of permissions for the selected user
  const [draft, setDraft] = useState<Permission[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Verify current user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setCurrentRole(me?.role as UserRole || null);
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, permissions')
      .in('role', ['admin', 'moderator'])
      .order('role')
      .order('full_name');

    setStaff(data || []);
    setLoading(false);
  }

  function selectMember(member: StaffMember) {
    setSelected(member);
    setSaved(false);
    // Start with their current custom permissions, or fall back to role defaults
    setDraft(member.permissions?.length ? member.permissions : [...ROLE_PERMISSIONS[member.role]]);
  }

  function togglePermission(perm: Permission) {
    if (ADMIN_ONLY.includes(perm)) return; // cannot grant admin-only perms
    setDraft(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
    setSaved(false);
  }

  function resetToDefaults() {
    if (!selected) return;
    setDraft([...ROLE_PERMISSIONS[selected.role]]);
    setSaved(false);
  }

  async function savePermissions() {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ permissions: draft })
      .eq('id', selected.id);

    setStaff(prev => prev.map(s =>
      s.id === selected.id ? { ...s, permissions: draft } : s
    ));
    setSelected(prev => prev ? { ...prev, permissions: draft } : null);
    setSaving(false);
    setSaved(true);
  }

  if (currentRole !== 'admin') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: brand.fontDisplay, fontSize: '28px', color: brand.dark500 }}>Access Restricted</p>
        <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark500, marginTop: '8px' }}>
          Only root admins can manage permissions.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .perm-toggle { cursor: pointer; transition: all 0.12s ease; }
        .perm-toggle:hover { opacity: 0.8; }
        @media (max-width: 767px) {
          .perm-layout { flex-direction: column !important; }
          .perm-panel  { width: 100% !important; position: static !important; }
        }
      `}</style>

      <div style={{ fontFamily: brand.fontUI }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: 'clamp(24px, 3vw, 32px)', color: brand.dark50, margin: 0 }}>
            Permissions
          </h1>
          <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark400, marginTop: '6px', letterSpacing: '0.04em' }}>
            ROOT ACCESS ONLY · CONTROL WHAT EACH MODERATOR CAN DO
          </p>
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: '16px' }} />
        </div>

        <div className="perm-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

          {/* ── LEFT: Staff list ── */}
          <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

            <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Staff Members
            </p>

            {loading ? (
              <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark500 }}>Loading…</p>
            ) : staff.map(member => (
              <div
                key={member.id}
                onClick={() => selectMember(member)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: selected?.id === member.id ? brand.goldMuted : brand.card,
                  border: `1px solid ${selected?.id === member.id ? brand.goldBorder : brand.border}`,
                  borderLeft: `3px solid ${member.role === 'admin' ? brand.gold : brand.teal}`,
                  transition: 'all 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontFamily: brand.fontUI, fontWeight: 600, fontSize: '13px', color: brand.dark50, margin: 0 }}>
                    {member.full_name || '—'}
                  </p>
                  <span style={{
                    fontFamily: brand.fontMono, fontSize: '9px', fontWeight: 500,
                    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    padding: '2px 8px', borderRadius: '999px',
                    background: member.role === 'admin' ? 'rgba(232,160,32,0.1)' : 'rgba(20,184,166,0.1)',
                    color: member.role === 'admin' ? brand.gold : brand.teal,
                    border: `1px solid ${member.role === 'admin' ? brand.goldBorder : brand.tealBorder}`,
                  }}>
                    {member.role === 'admin' ? '⬡ Root' : '◈ Mod'}
                  </span>
                </div>
                <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark400, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.email}
                </p>
                {member.permissions && member.permissions.length > 0 && (
                  <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.gold, margin: '4px 0 0' }}>
                    {member.permissions.length} custom permissions
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ── RIGHT: Permission editor ── */}
          {selected ? (
            <div className="perm-panel" style={{
              flex: 1, minWidth: 0,
              borderRadius: '14px', overflow: 'hidden',
              background: brand.card, border: `1px solid ${brand.border}`,
              position: 'sticky', top: '80px',
            }}>

              {/* Panel header */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${brand.border}`, background: brand.dark700 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{ fontFamily: brand.fontDisplay, fontWeight: 700, fontSize: '20px', color: brand.dark50, margin: 0 }}>
                      {selected.full_name}
                    </p>
                    <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.dark400, margin: '4px 0 0' }}>
                      {selected.email} · {selected.role}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={resetToDefaults}
                      style={{
                        fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600,
                        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                        background: 'transparent', color: brand.dark400, border: `1px solid ${brand.border}`,
                      }}
                    >
                      Reset to defaults
                    </button>
                    <button
                      onClick={savePermissions}
                      disabled={saving}
                      style={{
                        fontFamily: brand.fontUI, fontSize: '11px', fontWeight: 600,
                        padding: '6px 14px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer',
                        background: saved ? 'rgba(20,184,166,0.15)' : 'rgba(232,160,32,0.15)',
                        color: saved ? brand.teal : brand.gold,
                        border: `1px solid ${saved ? brand.tealBorder : brand.goldBorder}`,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {selected.role === 'admin' && (
                  <div style={{
                    marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
                    background: 'rgba(232,160,32,0.06)', border: `1px solid ${brand.goldBorder}`,
                  }}>
                    <p style={{ fontFamily: brand.fontMono, fontSize: '10px', color: brand.gold, margin: 0 }}>
                      ⬡ ROOT ACCOUNT — Admins always have full access. Permissions cannot be restricted.
                    </p>
                  </div>
                )}
              </div>

              {/* Permission groups */}
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', padding: '8px 0' }}>
                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                  <div key={group} style={{ padding: '16px 24px', borderBottom: `1px solid ${brand.border}` }}>
                    <p style={{ fontFamily: brand.fontMono, fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: brand.dark500, marginBottom: '12px' }}>
                      {group}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {perms.map(({ key, label, description }) => {
                        const isAdminOnly    = ADMIN_ONLY.includes(key);
                        const isEnabled      = selected.role === 'admin' ? true : draft.includes(key);
                        const isDefault      = ROLE_PERMISSIONS[selected.role]?.includes(key);
                        const isCustomGrant  = isEnabled && !isDefault;
                        const isCustomRevoke = !isEnabled && isDefault;
                        const locked         = selected.role === 'admin' || isAdminOnly;

                        return (
                          <div
                            key={key}
                            className="perm-toggle"
                            onClick={() => !locked && togglePermission(key)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: '12px',
                              padding: '10px 12px', borderRadius: '9px',
                              background: isEnabled
                                ? isCustomGrant ? 'rgba(20,184,166,0.06)' : 'rgba(232,160,32,0.05)'
                                : 'transparent',
                              border: `1px solid ${
                                isEnabled
                                  ? isCustomGrant ? 'rgba(20,184,166,0.2)' : 'rgba(232,160,32,0.15)'
                                  : brand.border
                              }`,
                              opacity: locked ? 0.5 : 1,
                              cursor: locked ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {/* Toggle checkbox */}
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                              background: isEnabled
                                ? isCustomGrant ? brand.teal : brand.gold
                                : 'transparent',
                              border: `1.5px solid ${isEnabled ? 'transparent' : brand.dark500}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginTop: '1px',
                            }}>
                              {isEnabled && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="var(--admin-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>

                            {/* Label + description */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 600, color: isEnabled ? brand.dark50 : brand.dark400 }}>
                                  {label}
                                </span>
                                {isAdminOnly && (
                                  <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.gold, background: brand.goldMuted, border: `1px solid ${brand.goldBorder}`, padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>
                                    ADMIN ONLY
                                  </span>
                                )}
                                {isCustomGrant && (
                                  <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.teal, background: brand.tealMuted, border: `1px solid ${brand.tealBorder}`, padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>
                                    CUSTOM GRANT
                                  </span>
                                )}
                                {isCustomRevoke && (
                                  <span style={{ fontFamily: brand.fontMono, fontSize: '9px', color: '#EF4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>
                                    REVOKED
                                  </span>
                                )}
                              </div>
                              <p style={{ fontFamily: brand.fontUI, fontSize: '12px', color: brand.dark500, margin: '2px 0 0', lineHeight: 1.4 }}>
                                {description}
                              </p>
                              <p style={{ fontFamily: brand.fontMono, fontSize: '9px', color: brand.dark600, margin: '3px 0 0', letterSpacing: '0.04em' }}>
                                {key}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ height: '24px' }} />
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '80px 40px', borderRadius: '14px',
              background: brand.card, border: `1px solid ${brand.border}`,
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: brand.fontDisplay, fontSize: '28px', color: brand.dark500, margin: 0 }}>
                  Select a staff member
                </p>
                <p style={{ fontFamily: brand.fontMono, fontSize: '11px', color: brand.dark500, marginTop: '8px' }}>
                  Choose someone from the list to manage their permissions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
