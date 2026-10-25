import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "@/components/ui/stat-card";

describe("StatCard", () => {
  it("renders the section, period, value, caption and the colored band", () => {
    const { container } = render(
      <StatCard
        section="Profile"
        period="Now"
        value="82%"
        caption="complete"
        bandTitle="Profile strength"
        bandTrend="Validated"
        bandIcon="person"
        bandClass="bg-orange-deep"
      />,
    );

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("complete")).toBeInTheDocument();
    expect(screen.getByText("Profile strength")).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.getByText("person")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Profile strength").closest("div.bg-orange-deep")).not.toBeNull();
    expect(container.firstElementChild).toHaveClass("rounded-2xl", "border-slate-border");
  });
});
