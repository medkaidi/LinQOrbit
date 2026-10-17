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

  it("rotates the two orbits ±44 by default and honours orbitRotation", () => {
    const { container } = render(<Logo />);
    const [slateOrbit, darkOrbit] = Array.from(container.querySelectorAll("ellipse"));

    expect(slateOrbit).toHaveAttribute("transform", "rotate(-44)");
    expect(darkOrbit).toHaveAttribute("transform", "rotate(44)");

    const overridden = render(<Logo orbitRotation={30} />);
    const [slateOverridden, darkOverridden] = Array.from(
      overridden.container.querySelectorAll("ellipse"),
    );

    expect(slateOverridden).toHaveAttribute("transform", "rotate(-30)");
    expect(darkOverridden).toHaveAttribute("transform", "rotate(30)");
  });
});
