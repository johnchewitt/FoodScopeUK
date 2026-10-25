/** Labels shared by the Risk Explorer's controls, cards, panels and legends (no components here). */
import type { FarmLayer, PpfiMeasure, RiskView } from "@/state/urlState";

export const VIEW_LABELS: Record<RiskView, { label: string; hint: string }> = {
  supply: {
    label: "International supply",
    hint: "Recorded import partners, concentration, estimated exposure and water stress",
  },
  logistics: { label: "Logistics", hint: "Ports, road corridors and agricultural production regions" },
  access: { label: "Community access", hint: "Priority places for food by council, within each nation" },
};

export const FARM_LABELS: Record<FarmLayer, string> = {
  off: "Off (outlines only)",
  wheat: "Wheat area",
  cattle: "Cattle",
  sheep: "Sheep",
  pigs: "Pigs",
  poultry: "Poultry",
};

export const PPFI_LABELS: Record<PpfiMeasure, string> = {
  combined: "Combined index",
  supermarket_proximity: "Proximity to supermarkets",
  supermarket_accessibility: "Accessibility of supermarkets",
  ecommerce_access: "Access to online deliveries",
  socio_demographic: "Socio-demographic barriers",
  nonsupermarket_proximity: "Proximity to other food provision",
  food_for_families: "Need for family food support",
  fuel_poverty: "Fuel poverty",
};

export const SUPPLY_KPI_LABELS = [
  "Recorded imports",
  "Recorded import partners",
  "Top supplier share",
  "Partner concentration (HHI)",
  "From high or critical water stress",
  "Data availability",
];
export const LOGISTICS_KPI_LABELS = [
  "Major ports",
  "Largest port",
  "Short Straits share of food imports",
  "Road delay (England)",
  "Data availability",
];
export const ACCESS_KPI_LABELS = [
  "Priority share (selected council)",
  "Rank within nation",
  "Nation's share",
  "Councils at 40 % or more",
  "Data availability",
];
