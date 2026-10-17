import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/(public)/page";

describe("HomePage", () => {
  it("affiche le hero de la vitrine", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Find your next professional trajectory" }),
    ).toBeInTheDocument();
    expect(screen.getByText("LinQ Career Intelligence")).toBeInTheDocument();
  });

  it("propose la recherche comme chemin vers l'inscription", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Search jobs" })).toHaveAttribute("href", "/signup");
    expect(screen.getByPlaceholderText("Job title, skills, stack...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("City, region or remote")).toBeInTheDocument();
  });

  it("affiche la photo de vitrine avec son overlay", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("img", { name: "Bright modern workspace for a tech recruitment platform" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified opportunities, refreshed weekly")).toBeInTheDocument();
    expect(screen.getByText("Real-time match scoring by your AI agents.")).toBeInTheDocument();
  });
});
