// components/rx/SageMark.tsx
// Sage's mark: the letter S in a circle that breathes slowly and forever. Never a face. Stops moving for anyone
// who asks their device for reduced motion.

export default function SageMark({ size = 20, still = false, label }: { size?: number; still?: boolean; label?: string }) {
  return (
    <span
      className={`rx-smark${still ? ' still' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      S
    </span>
  );
}
