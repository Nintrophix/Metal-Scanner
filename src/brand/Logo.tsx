export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <rect width="24" height="24" rx="5.5" fill="var(--accent)" />
      <path d="M5 5.5H19V11.5H12.5V18.5H7.3L5 16.2Z" fill="#fff" />
      <circle cx="8.7" cy="9" r="1.55" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, letterSpacing: '-0.01em', fontSize: size * 0.72 }}>
      <Mark size={size} />
      Irontronics
    </span>
  );
}
