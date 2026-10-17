import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "@/components/ui/status-pill";

describe("StatusPill", () => {
  it("applies the pill tone and colours the dot", () => {
    render(
      <StatusPill tone={{ pill: "bg-success-surface text-success-text", dot: "bg-success-text" }}>
        Published
      </StatusPill>,
    );

    const pill = screen.getByText("Published");
    expect(pill).toHaveClass("bg-success-surface", "text-success-text", "rounded-full");
    const dot = pill.querySelector("span");
    expect(dot).toHaveClass("bg-success-text", "rounded-full");
    expect(dot).toBeEmptyDOMElement();
  });
});
