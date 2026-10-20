// The little lamp drawing used on empty states (same artwork as the design prototype).
export default function EmptyLamp() {
  return (
    <svg viewBox="0 0 120 120" width={120} height={120} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="60" cy="66" r="40" fill="#C8A96E" opacity=".14" />
      <path d="M60 22v12" fill="none" stroke="var(--rx-muted)" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="34" width="32" height="44" rx="8" fill="none" stroke="var(--rx-muted)" strokeWidth="2" />
      <ellipse cx="60" cy="58" rx="6" ry="9" fill="var(--rx-rust)" opacity=".85" />
    </svg>
  );
}
