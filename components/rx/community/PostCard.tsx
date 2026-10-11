'use client';

// One Community post: rich text, media, three reactions, threaded comments, sharing, report and delete.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Flag, Lightbulb, Link2, MessageSquare, MoreHorizontal, Pin, Send, Share2, ThumbsUp, Trash2, Users, UserRound, Heart } from 'lucide-react';
import {
  addComment, deleteComment, deletePost, getShareTargets, reportContent, setReaction, sharePost, type ShareTargets,
} from '@/app/(app)/community/actions';
import { COMMENT_MAX, REACTION_LABEL, type CommentView, type PostView, type ReactionKind } from '@/lib/rx/feed-types';
import { Avatar, Tag } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';
import '@/styles/rx-community.css';

const ICON: Record<ReactionKind, React.ReactNode> = {
  like: <ThumbsUp aria-hidden />, support: <Heart aria-hidden />, insight: <Lightbulb aria-hidden />,
};

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, close]);
  return ref;
}

// ── comments ────────────────────────────────────────────────────────────────

function CommentBox({ placeholder, onSend, autoFocus }: { placeholder: string; onSend: (text: string) => Promise<string | null>; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const send = () => { if (!draft.trim()) return; start(async () => { const err = await onSend(draft); if (err) setError(err); else { setDraft(''); setError(''); } }); };
  return (
    <div className="rx-stack-sm" style={{ flex: 1, minWidth: 0 }}>
      <div className="rx-row rx-nw" style={{ gap: 6 }}>
        <input className="rx-in" style={{ borderRadius: 999 }} placeholder={placeholder} aria-label={placeholder} value={draft} maxLength={COMMENT_MAX} autoFocus={autoFocus}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
        <button type="button" className="rx-ib" aria-label="Send" disabled={pending || !draft.trim()} onClick={send}><Send aria-hidden /></button>
      </div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}

function CommentItem({ c, onReply, onDelete, onReport }: { c: CommentView; onReply: (parentId: string, text: string) => Promise<string | null>; onDelete: (id: string) => void; onReport: (id: string) => void }) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="rx-stack-sm">
      <div className="rx-comment">
        <Avatar name={c.name} url={c.avatarUrl} size="sm" seed={c.userId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rx-comment-body"><div className="who">{c.name}<span>{c.time}</span></div><p>{c.body}</p></div>
          <div className="rx-comment-tools">
            <button type="button" onClick={() => setReplying((r) => !r)}>Reply</button>
            {c.mine ? <button type="button" onClick={() => onDelete(c.id)}>Delete</button> : <button type="button" onClick={() => onReport(c.id)}>Report</button>}
          </div>
        </div>
      </div>
      {(c.replies.length > 0 || replying) && (
        <div className="rx-replies">
          {c.replies.map((r) => (
            <div key={r.id} className="rx-comment">
              <Avatar name={r.name} url={r.avatarUrl} size="sm" seed={r.userId} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="rx-comment-body"><div className="who">{r.name}<span>{r.time}</span></div><p>{r.body}</p></div>
                <div className="rx-comment-tools">
                  {r.mine ? <button type="button" onClick={() => onDelete(r.id)}>Delete</button> : <button type="button" onClick={() => onReport(r.id)}>Report</button>}
                </div>
              </div>
            </div>
          ))}
          {replying && <CommentBox autoFocus placeholder={`Reply to ${c.name}`} onSend={async (t) => { const err = await onReply(c.id, t); if (!err) setReplying(false); return err; }} />}
        </div>
      )}
    </div>
  );
}

// ── share ───────────────────────────────────────────────────────────────────

function ShareMenu({ post, close }: { post: PostView; close: () => void }) {
  const toast = useToast();
  const [targets, setTargets] = useState<ShareTargets | null>(null);
  const [step, setStep] = useState<'root' | 'circle' | 'person'>('root');
  const [, start] = useTransition();
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/community/post/${post.id}`;
  const canNative = typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function';

  useEffect(() => { void getShareTargets().then(setTargets).catch(() => setTargets({ circles: [], people: [] })); }, []);

  const done = (msg: string) => { toast(msg); close(); };

  return (
    <div className="rx-menu" role="menu" aria-label="Share this post" style={{ right: 0, top: 44 }}>
      {step === 'root' && (
        <>
          <button type="button" role="menuitem" onClick={() => start(async () => {
            try { await navigator.clipboard.writeText(url); await sharePost(post.id, 'link'); done('Link copied.'); } catch { done('Copy the link from the address bar of the post page.'); }
          })}><Link2 aria-hidden />Copy link</button>
          <button type="button" role="menuitem" onClick={() => setStep('circle')}><Users aria-hidden />Send to a Circle</button>
          <button type="button" role="menuitem" onClick={() => setStep('person')}><UserRound aria-hidden />Send to a person</button>
          {canNative && <button type="button" role="menuitem" onClick={() => { void navigator.share({ title: 'Ascentor', text: post.text.slice(0, 120), url }).then(() => sharePost(post.id, 'link')).catch(() => undefined); close(); }}><Share2 aria-hidden />More options</button>}
        </>
      )}
      {step === 'circle' && (
        <>
          <p className="rx-menu-label">Choose a Circle</p>
          {!targets && <p className="rx-sm" style={{ padding: '8px 10px' }}>Loading…</p>}
          {targets?.circles.map((c) => <button key={c.id} type="button" role="menuitem" onClick={() => start(async () => { const r = await sharePost(post.id, 'circle', c.id); done(r.ok ? `Shared with ${c.name}.` : r.error); })}>{c.name}</button>)}
          {targets && targets.circles.length === 0 && <p className="rx-sm" style={{ padding: '8px 10px' }}>You aren’t in a Circle yet.</p>}
          <button type="button" role="menuitem" onClick={() => setStep('root')}>Back</button>
        </>
      )}
      {step === 'person' && (
        <>
          <p className="rx-menu-label">People you talk to</p>
          {!targets && <p className="rx-sm" style={{ padding: '8px 10px' }}>Loading…</p>}
          {targets?.people.map((p) => <button key={p.threadId} type="button" role="menuitem" onClick={() => start(async () => { const r = await sharePost(post.id, 'person', p.threadId); done(r.ok ? `Sent to ${p.name}.` : r.error); })}>{p.name}</button>)}
          {targets && targets.people.length === 0 && <p className="rx-sm" style={{ padding: '8px 10px' }}>No conversations yet. Say hello in Messages first.</p>}
          <button type="button" role="menuitem" onClick={() => setStep('root')}>Back</button>
        </>
      )}
    </div>
  );
}

// ── the post ────────────────────────────────────────────────────────────────

export default function PostCard({ post: initial, canModerate, startOpen, onRemoved }: { post: PostView; canModerate?: boolean; startOpen?: boolean; onRemoved?: (id: string) => void }) {
  const toast = useToast();
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(!!startOpen);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [, start] = useTransition();
  const shareRef = useOutside(shareOpen, () => setShareOpen(false));
  const moreRef = useOutside(moreOpen, () => setMoreOpen(false));

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) { setSeen(initial); setPost(initial); }
  if (gone) return null;

  function react(kind: ReactionKind) {
    const before = post.reactions;
    const next = before.mine === kind ? null : kind;
    const counts = { like: before.like, support: before.support, insight: before.insight };
    if (before.mine) counts[before.mine]--;
    if (next) counts[next]++;
    setPost({ ...post, reactions: { ...counts, mine: next } });
    start(async () => {
      const r = await setReaction(post.id, next);
      if (!r.ok) { setPost((p) => ({ ...p, reactions: before })); toast(r.error); }
    });
  }

  async function sendComment(text: string, parentId: string | null): Promise<string | null> {
    const r = await addComment(post.id, text, parentId);
    if (!r.ok) return r.error;
    setPost((p) => {
      const flat = [...p.comments.flatMap((c) => [c, ...c.replies]), r.comment];
      const top = flat.filter((c) => !c.parentId || !flat.some((x) => x.id === c.parentId));
      const rootOf = (c: CommentView): string | null => { const par = flat.find((x) => x.id === c.parentId); return par ? (par.parentId ? par.parentId : par.id) : null; };
      const rebuilt = top.map((t) => ({ ...t, replies: flat.filter((c) => c.parentId && rootOf(c) === t.id).map((c) => ({ ...c, replies: [] })) }));
      return { ...p, comments: rebuilt, commentCount: p.commentCount + 1 };
    });
    return null;
  }

  function removeComment(id: string) {
    start(async () => {
      const r = await deleteComment(id);
      if (!r.ok) { toast(r.error); return; }
      setPost((p) => {
        const keep = (c: CommentView) => c.id !== id && c.parentId !== id;
        const top = p.comments.filter(keep).map((c) => ({ ...c, replies: c.replies.filter(keep) }));
        const count = top.reduce((n, c) => n + 1 + c.replies.length, 0);
        return { ...p, comments: top, commentCount: count };
      });
    });
  }

  const total = post.reactions.like + post.reactions.support + post.reactions.insight;
  const mediaClass = post.media.length === 1 ? 'one' : post.media.length === 2 ? 'two' : post.media.length === 3 ? 'three' : 'four';

  return (
    <article className="rx-card rx-stack-sm rx-rise" aria-label={`Post by ${post.name}`}>
      <div className="rx-row rx-nw" style={{ gap: 10 }}>
        <Avatar name={post.name} url={post.avatarUrl} seed={post.userId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="rx-strong" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.name}</p>
          <p className="rx-sm" style={{ margin: 0 }}>{post.isTeam ? 'Ascentor team · ' : ''}<Link href={`/community/post/${post.id}`} style={{ color: 'inherit' }}>{post.time}</Link></p>
        </div>
        {post.pinned && <Tag><Pin aria-hidden style={{ width: 12, height: 12, marginRight: 4 }} />Pinned</Tag>}
        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" className="rx-ib" aria-label="More actions" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}><MoreHorizontal aria-hidden /></button>
          {moreOpen && (
            <div className="rx-menu" role="menu" style={{ right: 0, top: 44 }}>
              {(post.mine || canModerate) && <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); start(async () => { const r = await deletePost(post.id); if (r.ok) { setGone(true); onRemoved?.(post.id); toast('Post removed.'); } else toast(r.error); }); }}><Trash2 aria-hidden />Delete post</button>}
              {!post.mine && <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); start(async () => { const r = await reportContent('post', post.id, 'Reported from the feed'); toast(r.ok ? 'Reported. Our safety team will review it.' : r.error); }); }}><Flag aria-hidden />Report post</button>}
            </div>
          )}
        </div>
      </div>

      {post.category && <div><Tag gold>{post.category}</Tag></div>}
      <div className="rx-rich" dangerouslySetInnerHTML={{ __html: post.html }} />

      {post.media.length > 0 && (
        <div className={`rx-media ${mediaClass}`}>
          {post.media.map((m) => m.kind === 'video'
            ? <video key={m.url} src={m.url} controls preload="metadata" playsInline />
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={m.url} src={m.url} alt="Photo shared in this post" loading="lazy" />)}
        </div>
      )}

      {(total > 0 || post.commentCount > 0 || post.shares > 0) && (
        <p className="rx-sm">
          {total > 0 && `${total} ${total === 1 ? 'reaction' : 'reactions'}`}
          {total > 0 && (post.commentCount > 0 || post.shares > 0) && ' · '}
          {post.commentCount > 0 && `${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`}
          {post.commentCount > 0 && post.shares > 0 && ' · '}
          {post.shares > 0 && `${post.shares} ${post.shares === 1 ? 'share' : 'shares'}`}
        </p>
      )}

      <div className="rx-post-actions">
        {(['like', 'support', 'insight'] as ReactionKind[]).map((k) => (
          <button key={k} type="button" className="rx-react" aria-pressed={post.reactions.mine === k} aria-label={`${REACTION_LABEL[k]}, ${post.reactions[k]}`} onClick={() => react(k)}>
            {ICON[k]}<span>{post.reactions[k] > 0 ? post.reactions[k] : REACTION_LABEL[k]}</span>
          </button>
        ))}
        <span className="rx-spacer" />
        <button type="button" className="rx-react" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MessageSquare aria-hidden /><span>{post.commentCount > 0 ? post.commentCount : 'Comment'}</span></button>
        <div ref={shareRef} style={{ position: 'relative' }}>
          <button type="button" className="rx-react" aria-expanded={shareOpen} onClick={() => setShareOpen((o) => !o)}><Share2 aria-hidden /><span>Share</span></button>
          {shareOpen && <ShareMenu post={post} close={() => setShareOpen(false)} />}
        </div>
      </div>

      {open && (
        <div className="rx-stack-sm rx-rise">
          {post.comments.map((c) => (
            <CommentItem key={c.id} c={c} onReply={(pid, t) => sendComment(t, pid)} onDelete={removeComment}
              onReport={(id) => start(async () => { const r = await reportContent('comment', id, 'Reported from a post'); toast(r.ok ? 'Reported. Our safety team will review it.' : r.error); })} />
          ))}
          {post.comments.length === 0 && <p className="rx-sm">No comments yet. Start the conversation.</p>}
          <CommentBox placeholder="Write a comment" onSend={(t) => sendComment(t, null)} />
        </div>
      )}
    </article>
  );
}
