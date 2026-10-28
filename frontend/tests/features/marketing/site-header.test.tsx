import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { pathnameMock, mountedMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/"),
  mountedMock: vi.fn(() => true),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

// L'hydratation est pilotée pour asservir les deux temps : le HTML prérendu
// ignore la session, le client la réagit après hydratation.
vi.mock("@/hooks/use-mounted", () => ({
  useMounted: () => mountedMock(),
}));

import { SiteHeader } from "@/features/marketing/site-header";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

const user: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: null,
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [],
};

beforeEach(() => {
  pathnameMock.mockReturnValue("/");
  mountedMock.mockReturnValue(true);
  useAuthStore.getState().clearAuth();
});

afterEach(cleanup);

describe("SiteHeader", () => {
  it("affiche les deux CTA d'authentification", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
  });

  it("remplace les CTA d'authentification par « Dashboard » quand une session est ouverte", () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  });

  it("garde les CTA d'origine tant que la session n'est pas hydratée", () => {
    // Avant l'hydratation, le HTML prérendu ne connaît pas la session :
    // la lire ici créerait une divergence d'hydratation.
    mountedMock.mockReturnValue(false);
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("aligne les liens sur l'encre et l'interlettrage du wordmark", () => {
    pathnameMock.mockReturnValue("/about");
    render(<SiteHeader />);

    // Onglet inactif : encre slate secondaire, gras moyen, interlettrage serré.
    const inactive = screen.getByRole("link", { name: "FAQ" });
    expect(inactive).toHaveClass("text-text-secondary", "hover:text-slate-ink", "font-medium");
    expect(inactive).toHaveClass("tracking-tight");

    // Onglet actif : exactement l'encre du wordmark (#334155).
    expect(screen.getByRole("link", { name: "About" })).toHaveClass("text-slate-ink");

    // CTA : même langage que les onglets.
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass(
      "text-text-secondary",
      "hover:text-slate-ink",
      "font-medium",
      "tracking-tight",
    );
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
