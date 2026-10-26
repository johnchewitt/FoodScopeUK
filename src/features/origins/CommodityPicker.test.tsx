import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoJson } from "@/test/files";
import type { TradeIndex } from "@/types/generated/trade-index";
import { CommodityPicker } from "./CommodityPicker";

// The committed sixteen-basket index (HMRC snapshot 2026-10-26).
const index = readRepoJson<TradeIndex>("public/data/snapshots/2026-10-26/trade/index.json");
const commodity = () => useAppStore.getState().commodity;

beforeEach(() => {
  resetAppStore();
  useAppStore.getState().setCommodity("beef");
});

describe("CommodityPicker with sixteen baskets (FO-01, B11)", () => {
  it("shows the groups as titled sections in one radio group", () => {
    render(<CommodityPicker index={index} unknownCommodity={false} />);
    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
    expect(screen.getAllByRole("radio")).toHaveLength(16);
    expect(screen.getByRole("radio", { name: /Beef and veal/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Beef and veal/ })).toHaveAccessibleDescription("Meat");
  });

  it("Enter in an empty search box keeps the selection", async () => {
    const user = userEvent.setup();
    render(<CommodityPicker index={index} unknownCommodity={false} />);
    const search = screen.getByRole("searchbox", { name: /Find a commodity/ });
    await user.click(search);
    await user.keyboard("{Enter}");
    expect(commodity()).toBe("beef");
    await user.type(search, "   {Enter}");
    expect(commodity()).toBe("beef");
  });

  it("Enter picks the best match: the name before the group or definition", async () => {
    const user = userEvent.setup();
    render(<CommodityPicker index={index} unknownCommodity={false} />);
    const search = screen.getByRole("searchbox", { name: /Find a commodity/ });
    await user.type(search, "cheese");
    // "Milk products (not cheese)" excludes cheese, so only Cheese is shown.
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("data-id"))).toEqual(["cheese"]);
    await user.keyboard("{Enter}");
    expect(commodity()).toBe("cheese");
    await user.clear(search);
    await user.type(search, "offal");
    // Beef excludes offal; poultry includes it (HS 0207, meat and edible offal).
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("data-id"))).toEqual(["poultry"]);
    await user.clear(search);
    await user.type(search, "HS 0403{Enter}");
    expect(commodity()).toBe("milk-products");
  });

  it("announces the count, keeps a selection hidden by the search, and Escape clears", async () => {
    const user = userEvent.setup();
    render(<CommodityPicker index={index} unknownCommodity={false} />);
    const search = screen.getByRole("searchbox", { name: /Find a commodity/ });
    await user.type(search, "meat");
    expect(screen.getByText("3 of 16 commodities shown.")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "coffee");
    expect(commodity()).toBe("beef");
    expect(screen.getByText(/Showing Beef and veal; the search hides it\./)).toBeInTheDocument();
    // The roving tab stop moves to the first option shown.
    expect(screen.getByRole("radio", { name: /Coffee/ })).toHaveAttribute("tabindex", "0");
    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("radio")).toHaveLength(16);
  });

  it("arrow keys move through the options shown, across groups", async () => {
    const user = userEvent.setup();
    render(<CommodityPicker index={index} unknownCommodity={false} />);
    screen.getByRole("radio", { name: /Poultry meat/ }).focus();
    useAppStore.getState().setCommodity("poultry");
    await user.keyboard("{ArrowDown}");
    expect(commodity()).toBe("milk-products"); // first in the next group, dairy
    expect(screen.getByRole("radio", { name: /Milk products/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(commodity()).toBe("cocoa");
    await user.keyboard("{ArrowDown}");
    expect(commodity()).toBe("tomatoes"); // wraps round
  });
});
