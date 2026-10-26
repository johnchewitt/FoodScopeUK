import { Apple, Banana, Beef, Citrus, Coffee, Drumstick, Milk, Package, Wheat } from "lucide-react";
import type { SVGProps } from "react";

/**
 * Single-colour commodity icons on a 24 px grid (spec §7.3). Banana, wheat, apple, citrus, beef,
 * drumstick, milk and coffee come from Lucide; tomato, strawberry, potato, rice, sheep, cheese,
 * sugar and cocoa are simple original drawings in the same stroke style.
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

function Rice(props: IconProps) {
  // A bowl of grains.
  return (
    <Svg {...props}>
      <path d="M3.5 12h17c0 4.4-3.8 8-8.5 8s-8.5-3.6-8.5-8Z" />
      <path d="M6.5 12c.3-2.3 2.6-4 5.5-4s5.2 1.7 5.5 4" />
      <path d="M9 9.8h.01M12 8.9h.01M15 9.8h.01M10.5 11h.01M13.5 11h.01" />
    </Svg>
  );
}

function Sheep(props: IconProps) {
  // A woolly body on four legs, head to the left.
  return (
    <Svg {...props}>
      <path d="M8 16.5c-2.2 0-3.7-1.6-3.3-3.4.2-1 1-1.6 1.9-1.8.3-1.7 1.9-2.8 3.6-2.5.8-1.1 2.5-1.5 3.8-.8 1.4-.6 3.1 0 3.8 1.3 1.6.1 2.8 1.5 2.5 3.1-.2 1.4-1.4 2.4-2.8 2.4" />
      <path d="M8 16.5h9.5" />
      <path d="M8.5 16.5V20M11.5 16.5V20M14.5 16.5V20M17 16.5V20" />
      <path d="M4.7 13.1 3 12.2c-.6-.3-.7-1.1-.2-1.5l1.5-1.2c.5-.4 1.2-.3 1.6.2l.9 1.4" />
    </Svg>
  );
}

function Cheese(props: IconProps) {
  // A wedge with holes.
  return (
    <Svg {...props}>
      <path d="M3 10.5 18.5 5 21 10.5Z" />
      <path d="M3 10.5V18h18v-7.5" />
      <path d="M8 14.5h.01M13 13h.01M16.5 15.5h.01M11 16.2h.01" />
    </Svg>
  );
}

function Sugar(props: IconProps) {
  // Two sugar cubes.
  return (
    <Svg {...props}>
      <path d="M3.5 12.5 8 10.5l4.5 2v5L8 19.5l-4.5-2Z" />
      <path d="M3.5 12.5 8 14.5l4.5-2M8 14.5v5" />
      <path d="M11.5 7.5 16 5.5l4.5 2v5L16 14.5l-1.5-.7" />
      <path d="M11.5 7.5 16 9.5l4.5-2M16 9.5v5M11.5 7.5v3.3" />
    </Svg>
  );
}

function Cocoa(props: IconProps) {
  // A ridged cocoa pod.
  return (
    <Svg {...props}>
      <path d="M12 3c3.6 1.8 5.5 5 5.5 9s-1.9 7.2-5.5 9c-3.6-1.8-5.5-5-5.5-9S8.4 4.8 12 3Z" />
      <path d="M12 3v18M9.2 5.5c-.6 2-.9 4.2-.9 6.5s.3 4.5.9 6.5M14.8 5.5c.6 2 .9 4.2.9 6.5s-.3 4.5-.9 6.5" />
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
    case "apples":
      return <Apple size={size} aria-hidden="true" />;
    case "oranges":
      return <Citrus size={size} aria-hidden="true" />;
    case "rice":
      return <Rice size={size} />;
    case "beef":
      return <Beef size={size} aria-hidden="true" />;
    case "sheep-goat":
      return <Sheep size={size} />;
    case "poultry":
      return <Drumstick size={size} aria-hidden="true" />;
    case "milk-products":
      return <Milk size={size} aria-hidden="true" />;
    case "cheese":
      return <Cheese size={size} />;
    case "sugar":
      return <Sugar size={size} />;
    case "coffee":
      return <Coffee size={size} aria-hidden="true" />;
    case "cocoa":
      return <Cocoa size={size} />;
    default:
      return <Package size={size} aria-hidden="true" />;
  }
}
