/** FOODSCOPE mark: a meridian globe with a single green "source" point. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label="FOODSCOPE UK">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--fs-cyan)" strokeWidth="1.8" />
      <path
        d="M3.5 16h25M16 3.5c-4 4-5.6 8.3-5.6 12.5S12 24.5 16 28.5c4-4 5.6-8.3 5.6-12.5S20 7.5 16 3.5z"
        fill="none"
        stroke="var(--fs-cyan)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle cx="23.6" cy="8.6" r="3" fill="var(--fs-green)" />
    </svg>
  );
}
