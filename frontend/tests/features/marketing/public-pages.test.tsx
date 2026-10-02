import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { About } from "@/features/marketing/about";
import { Contact } from "@/features/marketing/contact";
import { Faq } from "@/features/marketing/faq";
import { HowItWorks } from "@/features/marketing/how-it-works";
import { Privacy } from "@/features/marketing/privacy";
import { Terms } from "@/features/marketing/terms";

const PAGES = [
  {
    name: "About",
    Component: About,
    heading: "Aligning Exceptional Talents with Transformative Trajectories",
  },
  {
    name: "How it works",
    Component: HowItWorks,
    heading: "From Talent Sourcing to Day One in Four Intelligent Steps",
  },
  { name: "FAQ", Component: Faq, heading: "Frequently Asked Questions" },
  { name: "Contact", Component: Contact, heading: "Let's Connect and Propel Your Recruitment" },
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
  it("expose les trois emails des canaux en mailto", () => {
    render(<Contact />);

    expect(screen.getByRole("link", { name: /sales@linqorbit\.com/ })).toHaveAttribute(
      "href",
      "mailto:sales@linqorbit.com",
    );
    expect(screen.getByRole("link", { name: /contact@linqorbit\.com/ })).toHaveAttribute(
      "href",
      "mailto:contact@linqorbit.com",
    );
    expect(screen.getByRole("link", { name: /press@linqorbit\.com/ })).toHaveAttribute(
      "href",
      "mailto:press@linqorbit.com",
    );
  });

  it("affiche l'adresse du siège et le formulaire d'accès", () => {
    render(<Contact />);

    expect(screen.getByText("12 Rue de la Paix, 75002 Paris, France")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Request Platform Access" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Message/ })).toBeInTheDocument();
  });

  it("ne contient plus le bandeau Trusted by ni le statut SLA", () => {
    render(<Contact />);

    expect(screen.queryByText(/Trusted by 450/)).toBeNull();
    expect(screen.queryByText(/99.98% SLA/)).toBeNull();
    expect(screen.queryByText(/Book 15-min Slot/)).toBeNull();
  });
});

describe("FAQ", () => {
  it("chaque question s'ouvre nativement (details/summary)", () => {
    render(<Faq />);

    const first = screen.getByText("What is LinQOrbit?");
    expect(first.closest("details")).not.toBeNull();
    expect(screen.getByText(/Is LinQOrbit free\?/)).toBeInTheDocument();
  });

  it("filtre les questions via la recherche", () => {
    render(<Faq />);

    fireEvent.change(screen.getByLabelText("Search frequently asked questions"), {
      target: { value: "launch" },
    });

    expect(screen.getByText("When does it launch?")).toBeInTheDocument();
    expect(screen.queryByText("What is LinQOrbit?")).toBeNull();
  });

  it("affiche un état vide puis permet de réinitialiser la recherche", () => {
    render(<Faq />);

    fireEvent.change(screen.getByLabelText("Search frequently asked questions"), {
      target: { value: "zzzz-no-match" },
    });

    expect(screen.getByText("No matching questions found")).toBeInTheDocument();
    expect(screen.queryByText("What is LinQOrbit?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset search" }));

    expect(screen.getByText("What is LinQOrbit?")).toBeInTheDocument();
  });
});

describe("How it works", () => {
  it("conserve la trajectoire en 4 étapes et le CTA à 30 jours", () => {
    render(<HowItWorks />);

    expect(screen.getByText("Requirement Synthesis")).toBeInTheDocument();
    expect(screen.getByText("Autonomous Discovery")).toBeInTheDocument();
    expect(screen.getByText("Technical Vetting")).toBeInTheDocument();
    expect(screen.getByText("High-Conversion Outreach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start Free 30-Day Trial/ })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByText("30-day full access")).toBeInTheDocument();
  });

  it("ne contient plus les sections retirées", () => {
    render(<HowItWorks />);

    expect(screen.queryByText(/Comparative Benchmarks/)).toBeNull();
    expect(screen.queryByText(/Watch Product Tour/)).toBeNull();
    expect(screen.queryByText(/14-Day/)).toBeNull();
    expect(screen.queryByText(/Live Telemetry Loop/)).toBeNull();
  });
});

describe("About", () => {
  it("conserve les piliers, le showcase et le CTA contact", () => {
    render(<About />);

    expect(screen.getByText("Precision over Volume")).toBeInTheDocument();
    expect(screen.getByText("Multidimensional Talent Trajectory Modeling")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book Enterprise Demo/ })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("ne contient plus la photo, l'équipe ni les badges de conformité", () => {
    render(<About />);

    expect(screen.queryByText(/Pioneering the Next Era/)).toBeNull();
    expect(screen.queryByText(/Guaranteed Confidentiality/)).toBeNull();
    expect(screen.queryByText(/Elena Zhao/)).toBeNull();
    expect(screen.queryByText(/99.4%/)).toBeNull();
    expect(screen.queryByText(/View Dossier/)).toBeNull();
  });
});
