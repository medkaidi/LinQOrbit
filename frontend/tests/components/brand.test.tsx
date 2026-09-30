import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";

describe("brand assets", () => {
  it("exposes an accessible name on the logo", () => {
    render(<Logo />);

    expect(screen.getByRole("img", { name: "LinQOrbit" })).toBeInTheDocument();
  });

  it("exposes an accessible name on the wordmark", () => {
    render(<Wordmark />);

    expect(screen.getByRole("img", { name: "LinQOrbit" })).toBeInTheDocument();
  });

  it("allows overriding the accessible name", () => {
    render(<Wordmark title="LinQOrbit recruitment platform" />);

    expect(screen.getByRole("img", { name: "LinQOrbit recruitment platform" })).toBeInTheDocument();
  });
});
