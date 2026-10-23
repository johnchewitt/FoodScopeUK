import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStore, useAppStore } from "@/state/store";
import { provenanceProblems, type Indicator } from "@/types/indicator";
import { KpiCard } from "./KpiCard";
import { Metric } from "./Metric";

// Obviously synthetic indicator — used only to test rendering rules.
const synthetic: Indicator = {
  id: "synthetic.mass",
  label: "Synthetic mass",
  value: 12_345,
  unit: "t",
  provenance: "measured",
  sourceIds: ["S01"],
  referencePeriod: "2025-07",
  coverage: "UK",
  method: "Sum of synthetic test rows",
  scope: "local",
};

beforeEach(() => resetAppStore());

describe("provenanceProblems", () => {
  it("passes a complete indicator", () => expect(provenanceProblems(synthetic)).toEqual([]));
  it("lists every missing field", () => {
    const noSources = [] as unknown as Indicator["sourceIds"];
    const bad = {
      ...synthetic,
      sourceIds: noSources,
      referencePeriod: " ",
      unit: "",
      coverage: "",
      method: "",
      value: null,
    };
    expect(provenanceProblems(bad)).toEqual([
      "no source",
      "no reference period",
      "no unit",
      "no coverage",
      "no method",
      "missing value without a reason",
    ]);
  });
});

describe("<Metric>", () => {
  it("renders a formatted value with provenance, period and source", () => {
    render(<Metric indicator={synthetic} />);
    expect(screen.getByText("12.3 kt")).toBeInTheDocument();
    expect(screen.getByText("Measured")).toBeInTheDocument();
    expect(screen.getByText("2025-07")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sources: S01/ })).toBeInTheDocument();
  });

  it("labels national context (P6)", () => {
    render(<Metric indicator={{ ...synthetic, scope: "national_context" }} />);
    expect(screen.getByText("National context")).toBeInTheDocument();
  });

  it("explains missing values instead of showing zero (P12)", () => {
    render(<Metric indicator={{ ...synthetic, value: null, missingReason: "suppressed" }} />);
    expect(screen.getByText("Suppressed by the publisher")).toBeInTheDocument();
  });

  it("refuses to render a value without provenance (P1)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Metric indicator={{ ...synthetic, sourceIds: [] as unknown as Indicator["sourceIds"] }} />);
    expect(screen.queryByText("12.3 kt")).not.toBeInTheDocument();
    expect(screen.getByText("Source unavailable")).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("opens the evidence overlay from the source button", async () => {
    render(<Metric indicator={synthetic} />);
    await userEvent.click(screen.getByRole("button", { name: /Sources: S01/ }));
    expect(useAppStore.getState().overlay).toBe("evidence");
  });
});

describe("<KpiCard>", () => {
  it("shows no number in the empty state", () => {
    const { container } = render(
      <KpiCard label="Recorded imports" state="empty" note="Added in build stage 3" />,
    );
    expect(screen.getByText("No data loaded")).toBeInTheDocument();
    expect(container.textContent?.replace("stage 3", "")).not.toMatch(/\d/);
  });

  it("shows a skeleton while loading and an error message on failure", () => {
    const { rerender } = render(<KpiCard label="Recorded imports" state="loading" />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    rerender(<KpiCard label="Recorded imports" state="error" note="Data index unavailable" />);
    expect(screen.getByText("Could not load")).toBeInTheDocument();
  });

  it("shows a value only with a provenance-complete indicator", () => {
    render(<KpiCard label="Synthetic" state="ready" indicator={synthetic} />);
    expect(screen.getByText("12.3 kt")).toBeInTheDocument();
    expect(screen.getByText("2025-07, UK")).toBeInTheDocument();
  });
});
