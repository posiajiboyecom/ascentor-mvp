'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// FEATURE #7: Real-Time In-App Notification System
// Uses Supabase Realtime to push notifications instantly.
// Includes: NotificationProvider, NotificationBell, toast popup.
// ============================================================

// --- Types ---
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

// --- Notification Context ---
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  showToast: (title: string, message: string, type?: Notification['type']) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// --- Toast Component ---
function Toast({ title, message, type, onClose }: {
  title: string; message: string; type: string; onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const iconColor = {
    success: 'var(--success, #10B981)',
    error: 'var(--error, #EF4444)',
    warning: 'var(--accent, #E8A020)',
    info: 'var(--blue, #60A5FA)',
    coaching: 'var(--purple, #8B5CF6)',
    expert: 'var(--teal, #14B8A6)',
    community: 'var(--blue, #60A5FA)',
    payment: 'var(--success, #10B981)',
  }[type] || 'var(--blue, #60A5FA)';

  return (
    <div
      style={{
        background: 'var(--bg-card, #12151F)',
        border: `1px solid ${iconColor}30`,
        borderLeft: `3px solid ${iconColor}`,
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'toastSlideIn 0.3s ease-out',
        maxWidth: '380px',
        width: '100%',
      }}
    >
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: iconColor, marginTop: '5px', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {message}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', color: 'var(--text-dim)',
          cursor: 'pointer', padding: '2px', fontSize: '16px', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// --- Provider ---
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; type: string }>>([]);
  const supabase = createClient();

  // Fetch existing notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setNotifications(data);
    };

    fetchNotifications();
  }, [supabase]);

  // Subscribe to real-time notifications
  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            // Show toast for new notifications
            setToasts(prev => [...prev, {
              id: newNotif.id,
              title: newNotif.title,
              message: newNotif.message,
              type: newNotif.type,
            }]);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
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

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {toasts.map(t => (
            <Toast
              key={t.id}
              title={t.title}
              message={t.message}
              type={t.type}
              onClose={() => removeToast(t.id)}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}

// --- Notification Bell (for header) ---
export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications: ${unreadCount} unread`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '8px',
          color: 'var(--text-muted)',
          transition: 'color 0.2s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: 'var(--error, #EF4444)', color: '#fff',
            fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9996 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: '8px',
            width: '340px', maxHeight: '420px', overflowY: 'auto',
            background: 'var(--bg-card, #12151F)',
            border: '1px solid var(--border, #2A2D3A)',
            borderRadius: '12px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            zIndex: 9997,
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent)', fontSize: '12px', fontWeight: 500,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => { markAsRead(n.id); if (n.link) window.location.href = n.link; }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: n.link ? 'pointer' : 'default',
                    background: n.read ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {!n.read && (
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: 'var(--accent)', marginTop: '6px', flexShrink: 0,
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: n.read ? 400 : 600, color: 'var(--text)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --- SQL Schema ---
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

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
`;

// --- Server-side helper to send notifications ---
export const SEND_NOTIFICATION_CODE = `
// Usage from any API route:
// import { sendNotification } from '@/lib/notifications';
//
// await sendNotification(supabase, {
//   userId: 'uuid',
//   type: 'coaching',
//   title: 'Coaching Summary Ready',
//   message: 'Your session summary is available.',
//   link: '/coach',
// });

export async function sendNotification(supabase: any, params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  return supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  });
}
`;
