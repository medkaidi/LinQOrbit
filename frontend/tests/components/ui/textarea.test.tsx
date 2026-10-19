import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("shows its label by default", () => {
    render(<Textarea label="Bio" />);

    expect(screen.getByText("Bio")).not.toHaveClass("sr-only");
    expect(screen.getByRole("textbox", { name: "Bio" })).toBeInTheDocument();
  });

  it("keeps a hidden label readable by screen readers with hideLabel", () => {
    render(<Textarea label="Why this role?" hideLabel />);

    expect(screen.getByText("Why this role?")).toHaveClass("sr-only");
    expect(screen.getByRole("textbox", { name: "Why this role?" })).toBeInTheDocument();
  });

  it("keeps the label action visible when the label is hidden", () => {
    render(<Textarea label="Bio" hideLabel labelAction={<span>0/500</span>} />);

    expect(screen.getByText("Bio")).toHaveClass("sr-only");
    expect(screen.getByText("0/500")).toBeVisible();
  });

  it("exposes its error to assistive technologies", () => {
    render(<Textarea label="Bio" error="Too long." />);

    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Too long.");
  });
});
