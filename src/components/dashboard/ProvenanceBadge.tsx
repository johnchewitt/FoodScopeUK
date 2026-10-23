import { PROVENANCE_DESCRIPTIONS, PROVENANCE_LABELS, type ProvenanceClass } from "@/types/indicator";

/** Shape (not colour alone) distinguishes each provenance class (AX-05). */
function Glyph({ cls }: { cls: ProvenanceClass }) {
  const common = { width: 10, height: 10, viewBox: "0 0 10 10", "aria-hidden": true } as const;
  switch (cls) {
    case "measured":
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="4" fill="var(--fs-cyan)" />
        </svg>
      );
    case "official_estimate":
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="4" fill="none" stroke="var(--fs-cyan)" strokeWidth="1.4" />
          <path d="M5 1a4 4 0 0 1 0 8z" fill="var(--fs-cyan)" />
        </svg>
      );
    case "derived":
      return (
        <svg {...common}>
          <path d="M5 0.8 9.2 5 5 9.2 0.8 5z" fill="var(--fs-green)" />
        </svg>
      );
    case "scenario":
      return (
        <svg {...common}>
          <path d="M5 1 9.4 9H0.6z" fill="var(--fs-amber)" />
        </svg>
      );
    case "illustrative":
      return (
        <svg {...common}>
          <rect
            x="1"
            y="1"
            width="8"
            height="8"
            rx="2"
            fill="none"
            stroke="var(--fs-text-muted)"
            strokeDasharray="2 1.5"
          />
        </svg>
      );
  }
}

export function ProvenanceBadge({ cls, showLabel = true }: { cls: ProvenanceClass; showLabel?: boolean }) {
  return (
    <span className="prov-badge" data-class={cls} title={PROVENANCE_DESCRIPTIONS[cls]}>
      <Glyph cls={cls} />
      {showLabel ? PROVENANCE_LABELS[cls] : <span className="visually-hidden">{PROVENANCE_LABELS[cls]}</span>}
    </span>
  );
}
