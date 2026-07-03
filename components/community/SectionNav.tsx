'use client';

// components/community/SectionNav.tsx
// The Circle's left rail (reworked from the old ChannelSidebar). Leads with the
// three destinations that matter — This Week (home), The Commons (forum), My
// Circle — then the full channel list by category. Used on desktop as a fixed
// rail and on mobile as the full-screen list.

import { useMemo, useState } from 'react';
import type { Category, Channel } from './types';

export function SectionNav({
  categories,
  channels,
  view,
  activeSlug,
  onGoHome,
  onSelectChannel,
  unreadCounts,
  commonsSlug,
  myCircleSlug,
  mobile = false,
}: {
  categories: Category[];
  channels: Channel[];
  view: 'home' | 'channel';
  activeSlug: string | null;
  onGoHome: () => void;
  onSelectChannel: (channel: Channel) => void;
  unreadCounts: Record<string, number>;
  commonsSlug: string | null;
  myCircleSlug: string | null;
  /** On mobile the nav is content-height, not full-screen-height. */
  mobile?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of channels) {
      if (ch.is_pinned) continue;
      if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) continue;
      const list = map.get(ch.category_id) ?? [];
      list.push(ch);
      map.set(ch.category_id, list);
    }
    return map;
  }, [channels, search]);

  const pinnedChannels = channels.filter(
    (c) => c.is_pinned && (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  const commonsChannel = commonsSlug ? channels.find((c) => c.slug === commonsSlug) : null;
  const myCircle = myCircleSlug ? channels.find((c) => c.slug === myCircleSlug) : null;

  return (
    <div className={`flex flex-col bg-[#0C0B08] text-[#FAFAF8] ${mobile ? 'min-h-0' : 'h-full'}`}>
      <div className="px-4 py-4 border-b-[0.5px] border-white/[0.06]">
        <h1 className="text-lg font-semibold">The Circle</h1>
        <p className="text-xs text-[#6B7280] mt-0.5">{channels.length} channels</p>
      </div>

      {/* Primary destinations */}
      <div className="px-2 pt-2 flex flex-col gap-0.5">
        <PrimaryItem icon="◇" label="This Week" active={view === 'home'} onClick={onGoHome} />
        {commonsChannel && (
          <PrimaryItem
            icon="✦"
            label="The Commons"
            active={view === 'channel' && activeSlug === commonsChannel.slug}
            onClick={() => onSelectChannel(commonsChannel)}
          />
        )}
        {myCircle && (
          <PrimaryItem
            icon="◎"
            label="My Circle"
            active={view === 'channel' && activeSlug === myCircle.slug}
            onClick={() => onSelectChannel(myCircle)}
          />
        )}
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border-[0.5px] border-white/[0.08] px-3 py-1.5">
          <span className="text-[#4B5563] text-sm">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="flex-1 bg-transparent text-sm text-[#FAFAF8] placeholder:text-[#4B5563] outline-none"
          />
        </div>
      </div>

      <div className={`${mobile ? '' : 'flex-1'} overflow-y-auto pb-4`}>
        {pinnedChannels.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 py-1.5">
              <span className="text-[#C8A96E] text-xs">📌</span>
              <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#C8A96E]">Pinned</span>
            </div>
            {pinnedChannels.map((ch) => (
              <ChannelRow
                key={ch.slug}
                channel={ch}
                active={view === 'channel' && ch.slug === activeSlug}
                unread={unreadCounts[ch.slug] ?? 0}
                onClick={() => onSelectChannel(ch)}
              />
            ))}
          </div>
        )}

        {categories.map((cat) => {
          const list = channelsByCategory.get(cat.id) ?? [];
          if (list.length === 0) return null;
          const isCollapsed = collapsed[cat.id];

          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                className="flex items-center justify-between w-full px-4 py-1.5 text-left"
              >
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#4B5563]">{cat.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#4B5563]">{list.length}</span>
                  <span className={`text-[#4B5563] text-[10px] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                </span>
              </button>
              {!isCollapsed &&
                list.map((ch) => (
                  <ChannelRow
                    key={ch.slug}
                    channel={ch}
                    active={view === 'channel' && ch.slug === activeSlug}
                    unread={unreadCounts[ch.slug] ?? 0}
                    onClick={() => onSelectChannel(ch)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrimaryItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
        active ? 'bg-[#C8A96E]/[0.11] text-[#FAFAF8]' : 'text-[#9CA3AF] hover:bg-white/[0.03] hover:text-[#FAFAF8]'
      }`}
    >
      <span className={`w-4 text-center ${active ? 'text-[#C8A96E]' : 'text-[#6B7280]'}`}>{icon}</span>
      {label}
    </button>
  );
}

function ChannelRow({
  channel,
  active,
  unread,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-4 py-2 text-left transition-colors ${
        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C8A96E]/[0.08] text-sm">
        {channel.emoji ?? (channel.channel_type === 'announce' ? '📢' : '#')}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm truncate ${active ? 'text-[#FAFAF8] font-medium' : 'text-[#9CA3AF]'}`}>
          {channel.name}
        </span>
        {channel.description && <span className="block text-xs text-[#4B5563] truncate">{channel.description}</span>}
      </span>
      {unread > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C8A96E] px-1 text-[10px] font-medium text-[#0F0F0E]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
