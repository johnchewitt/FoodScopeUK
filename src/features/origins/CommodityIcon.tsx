import { Banana, Package, Wheat } from "lucide-react";
import type { SVGProps } from "react";

/**
 * Single-colour commodity icons on a 24 px grid (spec §7.3). Banana and wheat come from Lucide;
 * tomato, strawberry and potato are simple original drawings in the same stroke style.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

function Tomato(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 7.5c-4.6 0-8 2.9-8 6.6C4 18 7.5 21 12 21s8-3 8-6.9c0-3.7-3.4-6.6-8-6.6Z" />
      <path d="M12 7.5 9.2 5.6M12 7.5l2.8-1.9M12 7.5V4" />
      <path d="M8.6 8.4 7 9.6M15.4 8.4 17 9.6" />
    </Svg>
  );
}

function Strawberry(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 9.5C5.5 15 9 21 12 21s6.5-6 6.5-11.5c0-1.4-1.3-2.5-3.2-2.5H8.7c-1.9 0-3.2 1.1-3.2 2.5Z" />
      <path d="M9 7 7.5 4.5M12 7V3.5M15 7l1.5-2.5" />
      <path d="M9.5 11h.01M14.5 11h.01M12 14h.01M10 17h.01M14 17h.01" />
    </Svg>
  );
}

function Potato(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.3 6.2c2.4-2.3 6.6-2.5 9.8-.6 3.6 2.2 5 6.6 2.8 10.1-2.1 3.4-6.9 4.9-10.7 3.4C4.3 17.6 2.8 13.9 3.6 10.7c.4-1.7 1.4-3.3 2.7-4.5Z" />
      <path d="M9 9.5h.01M14.5 8.5h.01M12 13h.01M16 14.5h.01M8.5 15h.01" />
    </Svg>
  );
}

export function CommodityIcon({ id, size = 20 }: { id: string; size?: number }) {
  switch (id) {
    case "tomatoes":
      return <Tomato size={size} />;
    case "strawberries":
      return <Strawberry size={size} />;
    case "potatoes":
      return <Potato size={size} />;
    case "bananas":
      return <Banana size={size} aria-hidden="true" />;
    case "wheat":
      return <Wheat size={size} aria-hidden="true" />;
    default:
      return <Package size={size} aria-hidden="true" />;
  }
}
