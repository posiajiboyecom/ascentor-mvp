'use client';

import { useState } from 'react';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  signed_up: { label: 'Signed Up', color: 'var(--blue)', bg: 'rgba(59,130,246,0.09)' },
  onboarded: { label: 'Onboarded', color: 'var(--teal)', bg: 'rgba(20,184,166,0.09)' },
  subscribed: { label: 'Subscribed', color: 'var(--purple)', bg: 'rgba(139,92,246,0.09)' },
  rewarded: { label: 'Reward Earned', color: 'var(--success)', bg: 'rgba(16,185,129,0.09)' },
};

export default function ReferralClient({ firstName, referralCode, referralCount, referredBy, referrals }: {
  firstName: string;
  referralCode: string;
  referralCount: number;
  referredBy: string | null;
  referrals: any[];
}) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ascentorbi.com';
  const referralLink = `${baseUrl}/signup?ref=${referralCode}`;

  const rewardedCount = referrals.filter((r) => r.status === 'rewarded').length;
  const daysEarned = rewardedCount * 7;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareText = `I've been using Ascentor — an AI leadership coach built for African professionals. It's helping me level up my career. Join me and we both get 7 extra days free: ${referralLink}`;

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Ascentor',
          text: `I've been using Ascentor for AI leadership coaching. Join with my link and we both get 7 extra days free.`,
          url: referralLink,
        });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <div className="animate-fade-up py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
          Invite &amp; Earn
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Share Ascentor with fellow professionals. You both get <strong style={{ color: 'var(--accent)' }}>7 extra days free</strong>.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: '🔗', value: String(referralCount), label: 'INVITES', color: 'var(--accent)' },
          { icon: '🎁', value: String(rewardedCount), label: 'REWARDS', color: 'var(--success)' },
          { icon: '📅', value: `${daysEarned}d`, label: 'DAYS EARNED', color: 'var(--teal)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral Link Card */}
      <div className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', borderWidth: '1.5px' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
          Your Referral Link
        </p>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-3.5 py-2.5 rounded-lg text-sm truncate"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {referralLink}
          </div>
          <button onClick={copyLink}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
            style={{ background: copied ? 'var(--success)' : 'var(--accent)', color: '#000' }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Code */}
        <div className="flex items-center gap-2 mb-4">
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Or share your code:</p>
          <button onClick={copyCode}
            className="px-3 py-1 rounded-md text-xs font-bold tracking-wider transition-all"
            style={{
              background: copiedCode ? 'rgba(16,185,129,0.09)' : 'rgba(245,158,11,0.09)',
              color: copiedCode ? 'var(--success)' : 'var(--accent)',
              border: `1px solid ${copiedCode ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}>
            {copiedCode ? 'Copied!' : referralCode}
          </button>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-2 flex-wrap">
          <ShareBtn onClick={shareWhatsApp} bg="#25D366" label="WhatsApp"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>} />
          <ShareBtn onClick={shareTwitter} bg="#1DA1F2" label="Twitter"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>} />
          <ShareBtn onClick={shareLinkedIn} bg="#0A66C2" label="LinkedIn"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>} />
          {'share' in navigator && (
            <ShareBtn onClick={shareNative} bg="var(--bg-input)" label="More" textColor="var(--text-muted)"
              icon={<span className="text-sm">···</span>} border />
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>How It Works</h2>
        <div className="flex flex-col gap-3">
          <HowStep num={1} title="Share your link" desc="Send your unique link to colleagues, friends, or on social media." />
          <HowStep num={2} title="They sign up" desc="When someone joins Ascentor using your link, you'll see them here." />
          <HowStep num={3} title="Both get rewarded" desc="When they subscribe, you both get 7 extra days free. No limit!" />
        </div>
      </div>

      {/* Referred By */}
      {referredBy && (
        <div className="rounded-lg p-3 mb-4"
          style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            You were referred with code <strong style={{ color: 'var(--success)' }}>{referredBy}</strong>
          </p>
        </div>
      )}

      {/* Referral History */}
      <div className="rounded-xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Your Referrals</h2>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{referrals.length} total</span>
        </div>

        {referrals.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🔗</div>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              No referrals yet. Share your link to get started!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {referrals.map((r: any) => {
              const s = STATUS_MAP[r.status] || STATUS_MAP.signed_up;
              return (
                <div key={r.id} className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)' }}>
                      {r.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}22` }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareBtn({ onClick, bg, label, icon, textColor, border }: {
  onClick: () => void; bg: string; label: string; icon: React.ReactNode; textColor?: string; border?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
      style={{
        background: bg,
        color: textColor || '#fff',
        border: border ? '1px solid var(--border)' : 'none',
      }}>
      {icon}
      {label}
    </button>
  );
}

function HowStep({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.15)' }}>
        {num}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{desc}</p>
      </div>
    </div>
  );
}
