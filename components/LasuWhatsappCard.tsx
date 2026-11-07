// Invitation for LASU Ojo Campus students to join the Elevation Summit updates WhatsApp group.
// Shown after registering (success screen and /elevation-summit/confirmed). Same wording as the confirmation email.
import { MessageCircle } from 'lucide-react';
import { LASU_OJO_HEADING, LASU_OJO_TEXT, LASU_OJO_WHATSAPP_URL } from '@/lib/summitCommunity';

export default function LasuWhatsappCard({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '1.25rem 1.5rem', background: '#FBF5E1', border: '1px solid #E7D49A', borderRadius: '1rem', textAlign: 'center', ...style }}>
      <p style={{ color: '#0F0F0E', fontWeight: 700, margin: '0 0 0.375rem' }}>{LASU_OJO_HEADING}</p>
      <p style={{ color: '#4B5563', fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 1rem' }}>{LASU_OJO_TEXT}</p>
      <a
        href={LASU_OJO_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '0.625rem', background: '#B6502A', color: '#FFFFFF', fontWeight: 700, textDecoration: 'none' }}
      >
        <MessageCircle size={18} aria-hidden /> Join the WhatsApp group
      </a>
    </div>
  );
}
