'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Notification {
  id: string;
  user_id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'coaching' | 'expert' | 'community' | 'payment';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

// Brand color per notification type — uses the full Ascentor palette
const TYPE_COLOR: Record<string, { dot: string; border: string; bg: string; label: string }> = {
  info:      { dot: '#6662FF',  border: 'rgba(102,98,255,0.25)',  bg: 'rgba(102,98,255,0.06)',  label: '💬' },
  success:   { dot: '#10B981',  border: 'rgba(16,185,129,0.25)',  bg: 'rgba(16,185,129,0.06)',  label: '✅' },
  warning:   { dot: '#CFFF5E',  border: 'rgba(207,255,94,0.25)',  bg: 'rgba(207,255,94,0.06)',  label: '⚠️' },
  error:     { dot: '#EF4444',  border: 'rgba(239,68,68,0.25)',   bg: 'rgba(239,68,68,0.06)',   label: '❌' },
  coaching:  { dot: '#A6A2FF',  border: 'rgba(166,162,255,0.25)', bg: 'rgba(166,162,255,0.06)', label: '🤖' },
  expert:    { dot: '#14B8A6',  border: 'rgba(20,184,166,0.25)',  bg: 'rgba(20,184,166,0.06)',  label: '🎓' },
  community: { dot: '#FD81FD',  border: 'rgba(253,129,253,0.25)', bg: 'rgba(253,129,253,0.06)', label: '👥' },
  payment:   { dot: '#CFFF5E',  border: 'rgba(207,255,94,0.25)',  bg: 'rgba(207,255,94,0.06)',  label: '💳' },
};

const getTypeStyle = (type: string) => TYPE_COLOR[type] || TYPE_COLOR.info;

// --- Context ---
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  showToast: (title: string, message: string, type?: Notification['type']) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// --- Toast ---
function Toast({ title, message, type, onClose }: {
  title: string; message: string; type: string; onClose: () => void;
}) {
  const ts = getTypeStyle(type);

  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${ts.border}`,
      borderLeft: `3px solid ${ts.dot}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${ts.border}`,
      animation: 'toastSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      maxWidth: 360, width: '100%',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Type icon */}
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{ts.label}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
          {message}
        </div>
      </div>

      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-dim)', padding: '2px 4px', fontSize: 18, lineHeight: 1,
        borderRadius: 4, transition: 'color 0.15s',
      }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text)'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-dim)'; }}
      >×</button>
    </div>
  );
}

// --- Provider ---
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; type: string }>>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('notifications').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50);
      if (data) setNotifications(data);
    };
    fetchNotifications();
  }, [supabase]);

  useEffect(() => {
    let channel: any;
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload: any) => {
          const n = payload.new as Notification;
          setNotifications(prev => [n, ...prev]);
          setToasts(prev => [...prev, { id: n.id, title: n.title, message: n.message, type: n.type }]);
        })
        .subscribe();
    };
    setupRealtime();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [supabase]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [supabase]);

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [supabase]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, [supabase]);

  const showToast = useCallback((title: string, message: string, type: Notification['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, showToast }}>
      {children}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9998, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <Toast key={t.id} title={t.title} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// --- Notification Bell ---
export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`${unreadCount} unread notifications`}
        style={{
          background: open ? 'rgba(102,98,255,0.1)' : 'none',
          border: open ? '1px solid rgba(102,98,255,0.2)' : '1px solid transparent',
          borderRadius: 8, cursor: 'pointer',
          position: 'relative', padding: '7px 8px',
          color: open ? '#6662FF' : 'var(--text-muted)',
          transition: 'all 0.18s', display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#6662FF', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            boxShadow: '0 0 0 2px var(--bg)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9996 }} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 350, maxHeight: 440, overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            zIndex: 9997,
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                    background: 'rgba(102,98,255,0.12)', color: '#A6A2FF',
                    border: '1px solid rgba(102,98,255,0.2)', fontFamily: 'Inter, sans-serif',
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6662FF', fontSize: 12, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 16px', textAlign: 'center',
                color: 'var(--text-dim)', fontSize: 13,
                fontFamily: 'Inter, sans-serif',
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const ts = getTypeStyle(n.type);
                return (
                  <div
                    key={n.id}
                    onClick={() => { markAsRead(n.id); if (n.link) window.location.href = n.link; }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: n.link ? 'pointer' : 'default',
                      background: n.read ? 'transparent' : ts.bg,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (n.link) (e.currentTarget as HTMLElement).style.background = 'rgba(102,98,255,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : ts.bg; }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {/* Type icon badge */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: ts.bg, border: `1px solid ${ts.border}`, fontSize: 14,
                        marginTop: 1,
                      }}>
                        {ts.label}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: n.read ? 500 : 700,
                          color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif",
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {n.title}
                          {!n.read && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ts.dot, flexShrink: 0 }} />
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const NOTIFICATIONS_SQL = `
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
`;

export const SEND_NOTIFICATION_CODE = `
export async function sendNotification(supabase: any, params: {
  userId: string; type: string; title: string; message: string; link?: string;
}) {
  return supabase.from('notifications').insert({
    user_id: params.userId, type: params.type,
    title: params.title, message: params.message, link: params.link,
  });
}
`;
