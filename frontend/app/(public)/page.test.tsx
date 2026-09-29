import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage (vérification de l'environnement de test)", () => {
  it("se rend avec React Testing Library dans jsdom", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "LinQOrbit" })).toBeInTheDocument();
    expect(screen.getByText("Frontend under construction.")).toBeInTheDocument();
  });
});
