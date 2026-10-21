'use client';

// Invite and earn, as in the Ascentor App Prototype: what you earn, your link and code, share buttons,
// how it works, who has joined, and the rewards / fair-use notes in the side column.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, Linkedin, MoreHorizontal, Share2 } from 'lucide-react';
import { Aside, Avatar, Empty, Page, Tag, Title } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';

export type Invite = { id: string; name: string; joined: string; rewarded: boolean };

const REWARD_DAYS = 7;

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const stat: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 16px', background: 'var(--rx-card)', border: '1px solid var(--rx-border)', borderRadius: 12 };
const statN: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1.1 };

export default function ReferralClient({ code, daysEarned, invites }: { code: string; daysEarned: number; invites: Invite[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const link = `${typeof window !== 'undefined' ? window.location.origin : 'https://joinascentor.com'}/signup?ref=${code}`;
  const message = `I'm using Ascentor to build in a small Circle with a coach in my pocket. Join with my link and we both get ${REWARD_DAYS} extra days free: ${link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast('Link copied.'); setTimeout(() => setCopied(false), 2000); }
    catch { toast('Copy failed. Select the link and copy it.'); }
  };
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  const share = {
    wa: () => open(`https://wa.me/?text=${encodeURIComponent(message)}`),
    x: () => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`),
    li: () => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`),
    more: async () => {
      if (navigator.share) { try { await navigator.share({ title: 'Ascentor', text: message, url: link }); } catch { /* cancelled */ } }
      else copy();
    },
  };

  if (!code) {
    return <Page><Title>Invite and earn</Title><Empty>Your referral link is being set up. Check back in a moment.</Empty></Page>;
  }

  return (
    <Page>
      <Title>Invite and earn</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <p style={{ fontSize: 17, maxWidth: 600, margin: 0 }}>
            Share Ascentor with friends. When they subscribe, you both get <b style={{ color: 'var(--rx-gold)' }}>{REWARD_DAYS} extra days free</b>.
          </p>

          <div className="rx-grid3">
            <div style={stat}><span style={statN}>{invites.length}</span><span className="rx-sm">Invites</span></div>
            <div style={stat}><span style={statN}>{invites.length}</span><span className="rx-sm">Joined</span></div>
            <div style={stat}><span style={{ ...statN, color: 'var(--rx-gold)' }}>{daysEarned}d</span><span className="rx-sm">Days earned</span></div>
          </div>

          <div className="rx-card rx-stack">
            <p className="rx-label">Your referral link</p>
            <div className="rx-row rx-nw">
              <input className="rx-in" readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="rx-btn primary" onClick={copy}>{copied ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="rx-row" style={{ gap: 8 }}>
              <span className="rx-sm">Or share your code</span>
              <code style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--rx-line)', background: 'var(--rx-input)', fontWeight: 700 }}>{code}</code>
            </div>
            <div className="rx-row" style={{ gap: 8 }}>
              <button type="button" className="rx-btn secondary" style={{ minHeight: 44, padding: '0 14px' }} onClick={share.wa}><Share2 aria-hidden size={16} />WhatsApp</button>
              <button type="button" className="rx-btn secondary" style={{ minHeight: 44, padding: '0 14px' }} onClick={share.x}><span aria-hidden style={{ fontWeight: 800 }}>X</span>Post on X</button>
              <button type="button" className="rx-btn secondary" style={{ minHeight: 44, padding: '0 14px' }} onClick={share.li}><Linkedin aria-hidden size={16} />LinkedIn</button>
              <button type="button" className="rx-btn secondary" style={{ minHeight: 44, padding: '0 14px' }} onClick={share.more}><MoreHorizontal aria-hidden size={16} />More</button>
            </div>
          </div>

          <div className="rx-card rx-stack">
            <p className="rx-label">How it works</p>
            {[
              ['Share your link', 'Send it to friends and colleagues, or post it.'],
              ['They sign up', 'When someone joins with your link, they appear below.'],
              [`You both get rewarded`, `When they subscribe, you both get ${REWARD_DAYS} extra days. No limit.`],
            ].map(([t, d], i) => (
              <div key={t} className="rx-row rx-nw" style={{ gap: 14, alignItems: 'flex-start' }}>
                <span className="rx-pd cur" style={{ width: 28, height: 28, fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                <div><p style={{ margin: 0, fontWeight: 700 }}>{t}</p><p className="rx-sm">{d}</p></div>
              </div>
            ))}
          </div>

          <div className="rx-stack-sm">
            <p className="rx-label">Your invites</p>
            {invites.length === 0 ? (
              <Empty>No invites yet. Share your link to get started.</Empty>
            ) : (
              <div className="rx-card" style={{ padding: '4px 16px' }}>
                {invites.map((r) => (
                  <div key={r.id} className="rx-rowlink" style={{ cursor: 'default' }}>
                    <Avatar name={r.name} seed={r.id} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
                      <span className="rx-sm">Joined {when(r.joined)}</span>
                    </span>
                    {r.rewarded ? <Tag gold>+{REWARD_DAYS} days</Tag> : <Tag>Joined</Tag>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Aside>
          <p className="rx-label">Rewards</p>
          <p style={{ margin: 0 }}>Extra days are added to your next renewal. You can see them under Plan.</p>
          <div><Link href="/settings?tab=plan" className="rx-link">See my plan<ArrowRight aria-hidden /></Link></div>
          <p className="rx-label">Fair use</p>
          <p className="rx-sm">Rewards count when a friend’s first payment goes through. Self-referrals and duplicate accounts don’t count.</p>
        </Aside>
      </div>
    </Page>
  );
}
