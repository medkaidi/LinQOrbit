import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/(public)/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("HomePage", () => {
  it("affiche le hero de la vitrine", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Find your next professional trajectory" }),
    ).toBeInTheDocument();
    expect(screen.getByText("LinQ Career Intelligence")).toBeInTheDocument();
  });

  it("propose la recherche comme chemin vers le board public", () => {
    render(<HomePage />);

    // Un seul critère libre : le titre ou la société (ce que sait faire `q`).
    const field = screen.getByRole("textbox", { name: "Job title or company" });
    expect(field).toHaveAttribute("placeholder", "Job title or company");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    // Le champ lieu a disparu : aucune recherche par lieu n'existe côté API.
    expect(screen.queryByPlaceholderText("City, region or remote")).not.toBeInTheDocument();
    // La recherche mène au board, pas à l'inscription.
    expect(screen.getByRole("button", { name: "Search jobs" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("link", { name: "Search jobs" })).not.toBeInTheDocument();
  });

  it("affiche l'illustration orbite avec son overlay", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("img", { name: "LinQOrbit connects candidates with the right opportunities" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified opportunities, refreshed weekly")).toBeInTheDocument();
    expect(screen.getByText("Real-time match scoring by your AI agents.")).toBeInTheDocument();
  });
});
