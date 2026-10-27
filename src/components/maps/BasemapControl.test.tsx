import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_ZOOM, resetAppStore, selectRequestedMapStyle, useAppStore } from "@/state/store";
import { BasemapControl } from "./BasemapControl";

const at = (zoom: number) => ({ zoom, center: [-2.24, 53.48] as [number, number] });

async function openPanel() {
  render(<BasemapControl />);
  await userEvent.click(screen.getByRole("button", { name: /^Basemap: .*Change basemap$/ }));
  return screen.getByRole("group", { name: "Basemap" });
}

beforeEach(() => {
  resetAppStore();
  useAppStore.setState({ basemapChoice: true });
});

describe("basemap choice (SH-08)", () => {
  it("is hidden without a key", () => {
    useAppStore.setState({ basemapChoice: false });
    const { container } = render(<BasemapControl />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers five styles everywhere and holds the detailed four back under shaded areas", async () => {
    useAppStore.setState({ module: "origins" });
    const panel = await openPanel();
    for (const name of [
      /Dark grey/,
      /Light grey/,
      /Human Geography Light/,
      /Human Geography dark/,
      /Imagery/,
    ])
      expect(within(panel).getByRole("radio", { name })).toBeEnabled();
    const detailed = within(panel).getByRole("group", { name: "Lines and points only" });
    for (const name of [/Terrain/, /Topographic/, /National Geographic/, /OpenStreetMap/])
      expect(within(detailed).getByRole("radio", { name })).toBeDisabled();
    expect(within(panel).getByText(/offered where the map draws only lines and points/)).toBeVisible();
  });

  it("offers them on the logistics map and keeps the choice where the map shades areas", async () => {
    useAppStore.setState({ module: "risks", riskView: "logistics", farmLayer: "off" });
    const panel = await openPanel();
    await userEvent.click(within(panel).getByRole("radio", { name: /National Geographic/ }));
    expect(useAppStore.getState().basemap).toBe("natgeo");
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("natgeo");
    // Shading the farming regions brings light grey in; the choice stays and is explained.
    act(() => useAppStore.setState({ farmLayer: "wheat" }));
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("light");
    expect(within(panel).getByRole("radio", { name: /National Geographic/ })).toBeChecked();
    expect(within(panel).getByRole("radio", { name: /National Geographic/ })).toBeEnabled();
    expect(within(panel).getByRole("radio", { name: /Topographic/ })).toBeDisabled();
    expect(within(panel).getByText(/National Geographic is chosen: light grey is shown/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Basemap: Light grey. Change basemap" })).toBeInTheDocument();
  });

  it("offers them in UK Food Access at local scale, where councils are outlines", async () => {
    useAppStore.setState({ module: "access", mapView: at(LOCAL_ZOOM + 1) });
    const panel = await openPanel();
    expect(within(panel).getByRole("radio", { name: /Topographic/ })).toBeEnabled();
    expect(within(panel).queryByText(/offered where the map draws/)).toBeNull();
  });
});
