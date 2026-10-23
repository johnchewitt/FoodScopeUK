interface Props {
  width?: string | number;
  height?: string | number;
  label?: string;
}

/** Loading placeholder. Shimmer stops under reduced motion. */
export function Skeleton({ width = "100%", height = 14, label = "Loading" }: Props) {
  return (
    <span
      className="skeleton"
      style={{ width, height }}
      role="progressbar"
      aria-label={label}
      aria-busy="true"
    />
  );
}

export function SkeletonLines({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }} aria-label={label} aria-busy="true" role="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${90 - i * 15}%`, height: 12 }} />
      ))}
    </div>
  );
}
