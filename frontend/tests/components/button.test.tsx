import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Button, CtaButton } from "@/components/ui/button";

describe("CtaButton", () => {
  it("exposes its children as the accessible name and the badge as decoration", () => {
    render(<CtaButton icon="save">Save changes</CtaButton>);

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button.textContent).toContain("save");
  });

  it("forwards disabled state to the underlying button", () => {
    render(
      <CtaButton icon="upload_file" disabled aria-busy>
        Analyzing…
      </CtaButton>,
    );

    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  });

  it("runs the passed onClick", () => {
    let clicked = 0;
    render(
      <CtaButton icon="add" type="button" onClick={() => (clicked += 1)}>
        New Job
      </CtaButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    expect(clicked).toBe(1);
  });
});

describe("CtaButton tones", () => {
  it("defaults to the primary orange tone", () => {
    render(<CtaButton icon="add">New Job</CtaButton>);

    const button = screen.getByRole("button", { name: "New Job" });
    expect(button.className).toContain("text-orange-deep");
    expect(button.querySelector("span")?.className).toContain("bg-primary-container");
  });

  it("colors label and badge with the secondary tone", () => {
    render(
      <CtaButton icon="check" tone="secondary">
        Apply to my profile
      </CtaButton>,
    );

    const button = screen.getByRole("button", { name: "Apply to my profile" });
    expect(button.className).toContain("text-blue-deep");
    expect(button.querySelector("span")?.className).toContain("bg-blue-deep");
  });

  it("keeps the neutral tone free of the primary orange", () => {
    render(
      <CtaButton icon="delete" tone="neutral">
        Remove
      </CtaButton>,
    );

    const button = screen.getByRole("button", { name: "Remove" });
    expect(button.className).toContain("text-text-primary");
    expect(button.className).toContain("hover:bg-slate-border");
    expect(button.className).not.toContain("orange");
    const badge = button.querySelector("span");
    expect(badge?.className).toContain("bg-slate-surface");
    expect(badge?.className).not.toContain("orange");
  });
});

describe("Button soft variant", () => {
  it("keeps an inert header action disabled and labelled", () => {
    render(
      <Button variant="soft" type="button" disabled aria-disabled="true" title="Coming soon">
        Add photo
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Add photo" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Coming soon");
  });
});
