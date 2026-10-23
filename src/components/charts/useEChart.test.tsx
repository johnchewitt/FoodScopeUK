import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartFrame } from "./ChartFrame";
import { loadECharts } from "./useEChart";

describe("ECharts integration", () => {
  it("loads ECharts 6 with the registered chart types", async () => {
    const echarts = await loadECharts();
    expect(typeof echarts.init).toBe("function");
    expect(echarts.version.startsWith("6.")).toBe(true);
  });

  it("shows an empty state instead of drawing without data", () => {
    render(<ChartFrame title="Trend" option={null} emptyTitle="No chart yet" />);
    expect(screen.getByText("No chart yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("initialises an SVG chart when given an option (synthetic series)", async () => {
    const option = {
      xAxis: { type: "category", data: ["A", "B"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [1, 2] }],
    };
    const { container } = render(
      <ChartFrame title="Synthetic" option={option} description="Synthetic test chart" />,
    );
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    expect(await screen.findByRole("img", { name: "Synthetic test chart" })).toBeInTheDocument();
  });
});
