'use client';

// VideoPlayer: one place that turns { provider, id | url } into the right embed. Pages pass a provider and an id and never
// build embed URLs themselves, so moving lessons from YouTube to Vimeo is a data change.
//   youtube  privacy-enhanced embed (youtube-nocookie.com), lazy loaded
//   vimeo    typed and wired, not used until lessons move over
//   file     a direct MP4 or WebM in a <video> element
// The box is 16:9 and fills its container at any width (see .rx-video in styles/rx.css).

import { useEffect, useState, type Ref } from 'react';
import { embedSrc, type VideoSource } from '@/lib/rx/video';

export type VideoPlayerProps =
  | { provider: 'youtube'; id: string }
  | { provider: 'vimeo'; id: string; hash?: string | null }
  | { provider: 'file'; url: string };

type Common = {
  /** Accessible name of the player. */
  title: string;
  /** Where to start, in seconds. */
  startSec?: number;
  className?: string;
  frameRef?: Ref<HTMLIFrameElement>;
  onFrameLoad?: () => void;
};

export function toSource(p: VideoPlayerProps): VideoSource {
  if (p.provider === 'youtube') return { provider: 'youtube', id: p.id };
  if (p.provider === 'vimeo') return { provider: 'vimeo', id: p.id, hash: p.hash ?? null };
  return { provider: 'file', url: p.url };
}

export default function VideoPlayer(props: VideoPlayerProps & Common) {
  const { title, startSec = 0, className = '', frameRef, onFrameLoad } = props;
  // The embed needs this page's origin for its message channel; wait for the browser so server and client markup match.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  if (props.provider === 'file') {
    return <video className={`rx-video ${className}`} src={props.url} title={title} controls preload="metadata" style={{ width: '100%' }} />;
  }
  const src = embedSrc(toSource(props) as Exclude<VideoSource, { provider: 'file' }>, startSec, origin);
  return (
    <div className={`rx-video ${className}`}>
      {origin && (
        <iframe
          ref={frameRef} title={title} src={src} onLoad={onFrameLoad} loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen
        />
      )}
    </div>
  );
}
