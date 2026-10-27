import { CONSULTINGWHERE_LOGO } from "@/content/brand";

/** ConsultingWhere's logo on its white plate (D3): in About and at the head of the full report. */
export function BrandPlate() {
  return (
    <div className="brand-plate">
      <img
        src={CONSULTINGWHERE_LOGO.url}
        alt={CONSULTINGWHERE_LOGO.alt}
        width={CONSULTINGWHERE_LOGO.widthPx}
        height={CONSULTINGWHERE_LOGO.heightPx}
        decoding="async"
      />
    </div>
  );
}
