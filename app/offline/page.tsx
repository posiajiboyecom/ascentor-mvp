'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#0A0E17' }}>
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-5">📡</div>
        <h1 className="text-2xl font-semibold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: '#F1F0EB' }}>
          You're Offline
        </h1>
        <p className="text-sm mb-6" style={{ color: '#8B8A85', lineHeight: 1.7 }}>
          It looks like you've lost your internet connection. 
          Your coaching progress is safe — reconnect to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{ background: '#F59E0B', color: '#000' }}>
          Try Again
        </button>
        <p className="text-xs mt-4" style={{ color: '#5A5955' }}>
          Tip: Add Ascentor to your home screen for the best experience.
        </p>
      </div>
    </div>
  );
}
