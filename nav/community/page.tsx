'use client';

import { useState } from 'react';

const MEMBERS = ['AO', 'CE', 'DM', 'FK', 'JN', 'LM', 'NO', 'PK', 'SM', 'TW'];
const MEMBER_COLORS = ['var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--teal)', 'var(--success)'];

const INITIAL_POSTS = [
  { id: 1, author: 'Chioma E.', avatar: 'CE', time: '2h ago', content: "Had my 1:1 with my manager today. Used what came out of my mentor session — asked for the stretch project directly instead of hinting. She said YES! 🎉", likes: 7, comments: 3 },
  { id: 2, author: 'David M.', avatar: 'DM', time: '5h ago', content: "Struggling with the accountability piece this week. Too many fires at work. Any tips for protecting your mentorship and development time when everything feels urgent?", likes: 4, comments: 5 },
  { id: 3, author: 'System', avatar: '📅', time: '1d ago', content: "Weekly Circle Check-In\n\nHey circle! Let's start the week strong.\n\n1️⃣ One win from last week\n2️⃣ One challenge you're facing\n3️⃣ One commitment for this week\n4️⃣ One thing to discuss with your mentor\n\nDrop your update below 👇", likes: 2, comments: 8 },
];

export default function CommunityPage() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [newPost, setNewPost] = useState('');

  const addPost = () => {
    if (!newPost.trim()) return;
    setPosts([{
      id: Date.now(),
      author: 'You',
      avatar: 'YO',
      time: 'Just now',
      content: newPost,
      likes: 0,
      comments: 0,
    }, ...posts]);
    setNewPost('');
  };

  return (
    <div className="animate-fade-up py-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-semibold mb-0.5"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            Your Circle
          </h2>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Mentorship Circle · Builders · 10 members
          </p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
          Active
        </span>
      </div>

      {/* Members */}
      <div className="rounded-xl p-3.5 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Members</p>
        <div className="flex gap-2 flex-wrap">
          {MEMBERS.map((init, i) => (
            <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${MEMBER_COLORS[i % 5]}22, ${MEMBER_COLORS[i % 5]}44)`,
                border: `1.5px solid ${MEMBER_COLORS[i % 5]}55`,
                color: MEMBER_COLORS[i % 5],
              }}>
              {init}
            </div>
          ))}
        </div>
      </div>

      {/* New Post */}
      <div className="rounded-xl p-3.5 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Share a win, ask a question, or check in with your circle..."
          rows={3}
          className="w-full px-3.5 py-2.5 text-sm rounded-lg resize-none mb-2.5"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
        />
        <div className="flex justify-end">
          <button
            onClick={addPost}
            disabled={!newPost.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Post
          </button>
        </div>
      </div>

      {/* Feed */}
      {posts.map((post) => (
        <div key={post.id} className="rounded-xl p-5 mb-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex gap-2.5 items-start">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                background: post.author === 'System'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.13), rgba(59,130,246,0.27))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.27))',
                border: post.author === 'System'
                  ? '1.5px solid rgba(59,130,246,0.33)'
                  : '1.5px solid rgba(245,158,11,0.33)',
                color: post.author === 'System' ? 'var(--blue)' : 'var(--accent)',
              }}>
              {post.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{post.author}</span>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{post.time}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                {post.content}
              </p>
              <div className="flex gap-4 mt-2.5">
                <button className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  ♡ {post.likes}
                </button>
                <button className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  💬 {post.comments}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
