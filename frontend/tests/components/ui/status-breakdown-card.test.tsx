import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBreakdownCard } from "@/components/ui/status-breakdown-card";

const rows = [
  { id: "a", pill: <span>Draft</span>, value: "2" },
  { id: "b", pill: <span>Published</span>, value: "—" },
];

describe("StatusBreakdownCard", () => {
  it("is a region named by its title, with one pill and one value per row", () => {
    render(<StatusBreakdownCard title="Offers by status" rows={rows} />);

    const region = screen.getByRole("region", { name: "Offers by status" });
    expect(within(region).getByRole("heading", { name: "Offers by status" })).toBeInTheDocument();
    expect(within(region).getByText("Draft")).toBeInTheDocument();
    expect(within(region).getByText("Published")).toBeInTheDocument();
    expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["2", "—"]);
  });

  it("shows the summary next to the title when given", () => {
    render(<StatusBreakdownCard title="Offers by status" summary="12 offers" rows={rows} />);

    expect(screen.getByText("12 offers")).toBeInTheDocument();
  });

  it("shows no summary while the source is missing", () => {
    render(<StatusBreakdownCard title="Offers by status" summary={null} rows={rows} />);

    expect(screen.queryByText(/offers$/)).not.toBeInTheDocument();
  });

  describe("proportion bars", () => {
    const charted = [
      { id: "a", pill: <span>Draft</span>, value: "1", amount: 1, barClass: "bg-a" },
      { id: "b", pill: <span>Published</span>, value: "3", amount: 3, barClass: "bg-b" },
    ];

    function widths() {
      return screen.getAllByTestId("breakdown-bar").map((bar) => (bar as HTMLElement).style.width);
    }

    it("draws each row's share of the total, in the colour of its pill", () => {
      render(<StatusBreakdownCard title="Offers by status" rows={charted} />);

      expect(widths()).toEqual(["25%", "75%"]);
      const bars = screen.getAllByTestId("breakdown-bar");
      expect(bars[0]).toHaveClass("bg-a");
      expect(bars[1]).toHaveClass("bg-b");
    });

    it("keeps a non-empty row visible even when its share is tiny", () => {
      const rows = [
        { id: "a", pill: <span>Draft</span>, value: "1", amount: 1, barClass: "bg-a" },
        { id: "b", pill: <span>Published</span>, value: "999", amount: 999, barClass: "bg-b" },
      ];
      render(<StatusBreakdownCard title="Offers by status" rows={rows} />);

      expect(widths()[0]).toBe("4%");
    });

    it("leaves every track empty, with no NaN, when nothing is counted", () => {
      const rows = charted.map((row) => ({ ...row, value: "0", amount: 0 }));
      render(<StatusBreakdownCard title="Offers by status" rows={rows} />);

      expect(screen.getAllByTestId("breakdown-track")).toHaveLength(2);
      expect(widths()).toEqual(["0%", "0%"]);
    });

    it("draws nothing while a source is missing, and keeps the placeholder value", () => {
      const rows = charted.map((row) => ({ ...row, value: "—", amount: undefined }));
      render(<StatusBreakdownCard title="Offers by status" rows={rows} />);

      expect(screen.queryByTestId("breakdown-track")).not.toBeInTheDocument();
      expect(screen.getAllByText("—")).toHaveLength(2);
    });

    it("draws nothing for rows that are not shares of a whole", () => {
      render(<StatusBreakdownCard title="AI processing failures" rows={rows} />);

      expect(screen.queryByTestId("breakdown-track")).not.toBeInTheDocument();
    });

    it("keeps the bars decorative: the figure stays the accessible value", () => {
      render(<StatusBreakdownCard title="Offers by status" rows={charted} />);

      for (const track of screen.getAllByTestId("breakdown-track")) {
        expect(track).toHaveAttribute("aria-hidden", "true");
      }
      const region = screen.getByRole("region", { name: "Offers by status" });
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["1", "3"]);
    });
  });
});
