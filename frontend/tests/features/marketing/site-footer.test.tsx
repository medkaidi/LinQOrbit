import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/features/marketing/site-footer";

describe("SiteFooter", () => {
  it("relie les mentions légales à leurs pages", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Help & Support" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("laisse Recruteurs non cliquable tant que la page n'existe pas", () => {
    render(<SiteFooter />);

    expect(screen.queryByRole("link", { name: "Recruiters" })).toBeNull();
    expect(screen.getByText("Recruiters")).toBeInTheDocument();
  });

  it("affiche le copyright", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });
});
