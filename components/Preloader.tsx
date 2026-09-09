'use client';

import { useState, useEffect } from 'react';

type PreloaderProps = {
  minimumVisibleMs?: number;
};

export default function Preloader({ minimumVisibleMs = 1200 }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2200;
    const steps = 40;
    const interval = duration / steps;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(100, (elapsed / duration) * 100);
      const steppedProgress = Math.floor(rawProgress / (100 / steps)) * (100 / steps);
      const finalProgress = Math.min(steppedProgress, 100);

      setProgress(finalProgress);

      if (finalProgress >= 100) {
        clearInterval(timer);
        setTimeout(() => setVisible(false), minimumVisibleMs);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [minimumVisibleMs]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Metropolis:wght@400;500;600;700;800&display=swap');

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

      <div className="preloader">
        <img
          src="/ascentor-color-on-light.svg"
          alt="Ascentor"
          className="preloader-logo"
        />

        <div className="preloader-track">
          <div
            className="preloader-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="preloader-text">Loading</p>
      </div>
    </>
  );
}
