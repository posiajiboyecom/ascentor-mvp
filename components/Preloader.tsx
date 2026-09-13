'use client';

import { useState, useEffect } from 'react';

type PreloaderProps = {
  minimumVisibleMs?: number;
  /** Milliseconds for the bar to fill 0→100. Default 2200. */
  fillMs?: number;
};

export default function Preloader({ minimumVisibleMs = 1200, fillMs = 2200 }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let pct = 0;
    const timer = setInterval(() => {
      pct += 1;
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        // Hold at 100%, sweep the overlay off the top, then unmount
        // once the transition has finished (650ms).
        setTimeout(() => setExiting(true), minimumVisibleMs);
        setTimeout(() => setVisible(false), minimumVisibleMs + 700);
      }
    }, fillMs / 100);

    return () => clearInterval(timer);
  }, [minimumVisibleMs, fillMs]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }

        .preloader {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: #FAFAF8;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          font-family: Metropolis;
          transform: translateY(0);
          transition: transform 0.65s cubic-bezier(0.76, 0, 0.24, 1);
          will-change: transform;
        }

        .preloader.exiting {
          transform: translateY(-100%);
        }

        .preloader-logo {
          width: 120px;
          height: auto;
          opacity: 0.9;
        }

        .preloader-track {
          width: 180px;
          height: 2px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }

        .preloader-bar {
          height: 100%;
          background: #0F0F0E;
          border-radius: 2px;
          transition: width 0.1s linear;
        }

        .preloader-text {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(0, 0, 0, 0.35);
          margin: 0;
        }
      `}</style>

      <div className={`preloader${exiting ? ' exiting' : ''}`}>
        <img
          src="/ascentor-color-for-light-pages.svg"
          alt="Ascentor"
          className="preloader-logo"
        />

        <div className="preloader-track">
          <div
            className="preloader-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="preloader-text">{progress}%</p>
      </div>
    </>
  );
}
