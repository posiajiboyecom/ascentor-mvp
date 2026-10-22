'use client';

// components/billing/CardsPanel.tsx
// Payment methods: list saved cards (brand, last4, expiry, bank, Default badge), Add a card, Make default, Remove.
// Used by Settings > Billing and by checkout v2. Talks only to /api/billing/cards/*. Authorization codes never reach the browser;
// the list only has safe fields. Shows the server's own refusal text (for example "this is your only card").
//
// Adding a card: POST /cards/start -> Paystack's hosted page (card channel, NGN 50 check) -> Paystack returns the member to
// `<returnTo>?card=verify&reference=...` -> this panel calls POST /cards/verify on mount and shows the result.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Info, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { confirmAction } from '@/components/Modal';
import { brandName, expiry } from './format';

export interface CardView {
  id: string; brand: string | null; last4: string | null; expMonth: string | null; expYear: string | null; bank: string | null; isDefault: boolean;
}

type Msg = { kind: 'ok' | 'bad' | 'info'; text: string } | null;

export default function CardsPanel({ initialCards, returnTo, verifyAmountLabel, onCardsChange, beforeRedirect, heading = 'Payment methods', intro }: {
  initialCards: CardView[];
  returnTo: 'settings' | 'checkout';
  /** "₦50", from the server so the amount lives in one place. */
  verifyAmountLabel: string;
  onCardsChange?: (cards: CardView[]) => void;
  /** Runs just before the browser leaves for Paystack (checkout saves the member's choices here). */
  beforeRedirect?: () => void;
  heading?: string;
  intro?: string;
}) {
  const toast = useToast();
  const [cards, setCards] = useState<CardView[]>(initialCards);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null); // 'add' | 'verify' | card id
  const handledRef = useRef(false);

  const apply = useCallback((next: CardView[]) => { setCards(next); onCardsChange?.(next); }, [onCardsChange]);

  // Coming back from Paystack.
  useEffect(() => {
    if (handledRef.current) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('card') !== 'verify') return;
    handledRef.current = true;
    const reference = q.get('reference') || q.get('trxref');
    const clean = () => {
      const u = new URL(window.location.href);
      u.searchParams.delete('card'); u.searchParams.delete('reference'); u.searchParams.delete('trxref');
      window.history.replaceState(null, '', u.pathname + (u.search || ''));
    };
    if (!reference) { clean(); setMsg({ kind: 'bad', text: 'We did not get a card check back from Paystack, so no card was added. Please try again.' }); return; }
    setBusy('verify');
    setMsg({ kind: 'info', text: 'Checking your card with Paystack...' });
    (async () => {
      try {
        const r = await fetch('/api/billing/cards/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setMsg({ kind: 'bad', text: `We could not add that card. ${body.error ? String(body.error) + ' ' : ''}Try again, or use a different card. The ${verifyAmountLabel} check is never kept.` });
        } else {
          const c = body.card as CardView;
          const refundNote = body.refund === 'failed'
            ? ` We could not send the ${verifyAmountLabel} check back automatically. Please contact us and we will return it.`
            : ` The ${verifyAmountLabel} check has been refunded to you.`;
          const text = body.added === false ? `That card (${brandName(c.brand)} ending ${c.last4}) was already saved.${refundNote}` : `${brandName(c.brand)} ending ${c.last4} was added.${refundNote}`;
          setMsg({ kind: 'ok', text });
          toast(body.added === false ? 'That card was already saved.' : 'Card added.');
          const list = await fetch('/api/billing/cards', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
          if (list?.cards) apply(list.cards as CardView[]);
        }
      } catch {
        setMsg({ kind: 'bad', text: 'We could not reach the server to finish adding your card. Please try again.' });
      }
      clean();
      setBusy(null);
    })();
  }, [apply, toast, verifyAmountLabel]);

  const addCard = async () => {
    setBusy('add'); setMsg(null);
    try {
      const r = await fetch('/api/billing/cards/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnTo }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.authorizationUrl) { setMsg({ kind: 'bad', text: body.error || 'We could not open the card page. Please try again.' }); setBusy(null); return; }
      beforeRedirect?.();
      window.location.href = body.authorizationUrl as string;
    } catch {
      setMsg({ kind: 'bad', text: 'We could not reach the server. Please try again.' });
      setBusy(null);
    }
  };

  const makeDefault = async (c: CardView) => {
    setBusy(c.id); setMsg(null);
    try {
      const r = await fetch('/api/billing/cards/default', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: c.id }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ kind: 'bad', text: body.error || 'We could not change your default card.' });
      else { apply(body.cards as CardView[]); setMsg({ kind: 'ok', text: `${brandName(c.brand)} ending ${c.last4} is now your default card.` }); toast('Default card changed.'); }
    } catch { setMsg({ kind: 'bad', text: 'We could not reach the server. Nothing was changed.' }); }
    setBusy(null);
  };

  const remove = async (c: CardView) => {
    const ok = await confirmAction(`Remove ${brandName(c.brand)} ending ${c.last4}? We will delete it from your account and it can never be charged again.`, { title: 'Remove this card?', confirmLabel: 'Remove card', danger: true });
    if (!ok) return;
    setBusy(c.id); setMsg(null);
    try {
      const r = await fetch(`/api/billing/cards/${c.id}`, { method: 'DELETE' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ kind: 'bad', text: body.error || 'We could not remove this card.' });
      else { apply(body.cards as CardView[]); setMsg({ kind: 'ok', text: `${brandName(c.brand)} ending ${c.last4} was removed.` }); toast('Card removed.'); }
    } catch { setMsg({ kind: 'bad', text: 'We could not reach the server. Nothing was removed.' }); }
    setBusy(null);
  };

  return (
    <section className="rx-card st" aria-labelledby="bl-cards-h">
      <div className="rx-stack-sm">
        <h2 id="bl-cards-h" className="rx-h3">{heading}</h2>
        {intro && <p className="rx-sm">{intro}</p>}
      </div>

      {cards.length === 0 ? (
        <p className="rx-p">You have no saved cards yet.</p>
      ) : (
        <ul className="bl-cards" aria-label="Saved cards">
          {cards.map((c) => {
            const exp = expiry(c.expMonth, c.expYear);
            const name = `${brandName(c.brand)} ending ${c.last4 ?? ''}`;
            return (
              <li key={c.id} className={`bl-card${c.isDefault ? ' def' : ''}`}>
                <span className="ic" aria-hidden><CreditCard /></span>
                <div className="meta">
                  <b>{name}</b>
                  <span>{[exp && `Expires ${exp}`, c.bank].filter(Boolean).join(' · ') || 'Card'}</span>
                </div>
                {c.isDefault && <span className="rx-tag rust">Default</span>}
                <div className="acts">
                  {!c.isDefault && (
                    <button type="button" className="rx-btn lkb bl-focus" disabled={busy !== null} onClick={() => makeDefault(c)} aria-label={`Make ${name} your default card`}>
                      {busy === c.id ? 'Working...' : 'Make default'}
                    </button>
                  )}
                  <button type="button" className="rx-btn lkb muted bl-focus" disabled={busy !== null} onClick={() => remove(c)} aria-label={`Remove ${name}`}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {msg && <div className={`bl-msg ${msg.kind === 'ok' ? 'ok' : msg.kind === 'bad' ? 'bad' : ''}`} role={msg.kind === 'bad' ? 'alert' : 'status'} aria-live="polite">{msg.text}</div>}

      <div className="rx-row">
        <button type="button" className="rx-btn secondary bl-focus" onClick={addCard} disabled={busy !== null}>
          {busy === 'add' || busy === 'verify' ? <Loader2 aria-hidden className="bl-spin" /> : <Plus aria-hidden style={{ width: 18, height: 18 }} />}
          {busy === 'add' ? 'Opening Paystack...' : busy === 'verify' ? 'Checking your card...' : 'Add a card'}
        </button>
      </div>

      <div className="bl-note">
        <Info aria-hidden />
        <p style={{ margin: 0 }}>
          To add a card we charge {verifyAmountLabel} on Paystack&rsquo;s secure page to check it works, then refund it straight away. Subscriptions renew by card only: bank transfer and USSD cannot be used for renewals.
        </p>
      </div>
    </section>
  );
}
