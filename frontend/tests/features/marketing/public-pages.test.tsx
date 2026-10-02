import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { About } from "@/features/marketing/about";
import { Contact } from "@/features/marketing/contact";
import { Faq } from "@/features/marketing/faq";
import { HowItWorks } from "@/features/marketing/how-it-works";
import { Privacy } from "@/features/marketing/privacy";
import { Terms } from "@/features/marketing/terms";

const PAGES = [
  { name: "About", Component: About, heading: "Career intelligence, built for people" },
  { name: "How it works", Component: HowItWorks, heading: "From profile to offer in four steps" },
  { name: "FAQ", Component: Faq, heading: "Questions, answered" },
  { name: "Contact", Component: Contact, heading: "Talk to us" },
  { name: "Privacy", Component: Privacy, heading: "Privacy notice" },
  { name: "Terms", Component: Terms, heading: "Terms of use" },
] as const;

describe.each(PAGES)("Page publique : $name", ({ Component, heading }) => {
  it(`rend le titre « ${heading} »`, () => {
    render(<Component />);

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });
});

describe("Pages légales", () => {
  it("Privacy indique sa date de mise à jour", () => {
    render(<Privacy />);

    expect(screen.getByText(/Last updated: October 2026/)).toBeInTheDocument();
    expect(screen.getByText(/contact@linqorbit\.com/)).toBeInTheDocument();
  });

  it("Terms contient les sections essentielles", () => {
    render(<Terms />);

    expect(screen.getByText("3. Acceptable use")).toBeInTheDocument();
    expect(screen.getByText("6. Limitation of liability")).toBeInTheDocument();
  });
});

describe("Contact", () => {
  it("expose l'adresse email en mailto", () => {
    render(<Contact />);

    expect(screen.getByRole("link", { name: "contact@linqorbit.com" })).toHaveAttribute(
      "href",
      "mailto:contact@linqorbit.com",
    );
  });
});

describe("FAQ", () => {
  it("chaque question s'ouvre nativement (details/summary)", () => {
    render(<Faq />);

    const first = screen.getByText("What is LinQOrbit?");
    expect(first.closest("details")).not.toBeNull();
    expect(screen.getByText(/Is LinQOrbit free\?/)).toBeInTheDocument();
  });
});
