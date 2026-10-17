import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavPill } from "@/components/ui/nav-pill";

describe("NavPill", () => {
  it("renders a navigation link when an href is provided", () => {
    render(<NavPill icon="edit" label="Edit profile" href="/profile/edit" />);

    const link = screen.getByRole("link", { name: "Edit profile" });
    expect(link).toHaveAttribute("href", "/profile/edit");
    expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
  });

  it("renders a plain button when there is no href", () => {
    render(<NavPill icon="rocket_launch" label="New campaign" />);

    const button = screen.getByRole("button", { name: "New campaign" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("merges an optional className without dropping the base styles", () => {
    render(<NavPill icon="edit" label="Edit profile" href="/profile/edit" className="shrink-0" />);

    const link = screen.getByRole("link", { name: "Edit profile" });
    expect(link.className).toContain("rounded-full");
    expect(link.className).toContain("shrink-0");
  });

  it("keeps the decorative icons out of the accessible name", () => {
    render(<NavPill icon="edit" label="Edit profile" href="/profile/edit" />);

    expect(screen.getByRole("link")).toHaveAccessibleName("Edit profile");
  });

  it("renders no trailing navigation arrow", () => {
    render(<NavPill icon="edit" label="Edit profile" href="/profile/edit" />);

    expect(screen.getByRole("link").textContent).not.toContain("north_east");
  });

  it("keeps the primary orange accents by default and swaps them for a tone", () => {
    const { rerender } = render(<NavPill icon="edit" label="Edit profile" href="/profile/edit" />);
    expect(screen.getByRole("link").className).toContain("hover:border-orange-border-strong");

    rerender(<NavPill icon="edit" label="Edit profile" href="/profile/edit" tone="danger" />);
    const link = screen.getByRole("link", { name: "Edit profile" });
    expect(link.className).toContain("hover:border-danger");
    expect(link.className).not.toContain("orange");
  });
});
