import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { META_CHIP_ACCENT_CLASS, META_CHIP_CLASS } from "@/components/ui/pill";
import { MetaChip } from "@/features/job-offer/job-offer-card";

function classesOf(value: string) {
  return value.split(" ");
}

describe("MetaChip", () => {
  it("renders the neutral chip with a muted icon by default", () => {
    render(<MetaChip icon="location_on">Paris, France</MetaChip>);

    const chip = screen.getByText("Paris, France");
    expect(chip).toHaveClass(...classesOf(META_CHIP_CLASS));
    expect(chip.querySelector("span")).toHaveClass("text-text-tertiary");
  });

  it("renders the accent chip in the same outline with the icon inheriting the text colour", () => {
    render(
      <MetaChip icon="event" tone="accent">
        Expires tomorrow
      </MetaChip>,
    );

    const chip = screen.getByText("Expires tomorrow");
    expect(chip).toHaveClass(...classesOf(META_CHIP_ACCENT_CLASS));
    expect(chip).not.toHaveClass("bg-item-surface/50");
    expect(chip.querySelector("span")).not.toHaveClass("text-text-tertiary");
  });
});
