import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

import { SiteHeader } from "@/features/marketing/site-header";

afterEach(cleanup);

describe("SiteHeader", () => {
  it("affiche les deux CTA d'authentification", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
  });

  it("marque l'onglet actif selon la route courante", () => {
    pathnameMock.mockReturnValue("/about");
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
  });

  it("n'a aucun onglet actif sur l'accueil", () => {
    pathnameMock.mockReturnValue("/");
    render(<SiteHeader />);

    for (const name of ["About", "How it works", "FAQ", "Contact"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("pointe chaque onglet vers sa route publique", () => {
    pathnameMock.mockReturnValue("/");
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });
});
