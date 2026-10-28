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
    heading: "Matching Job Offers and Candidate Profiles, Criterion by Criterion",
  },
  {
    name: "How it works",
    Component: HowItWorks,
    heading: "From a Job Description to a Decision, in Four Steps",
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
      target: { value: "available" },
    });

    expect(screen.getByText("Is LinQOrbit available now?")).toBeInTheDocument();
    expect(screen.queryByText("What is LinQOrbit?")).toBeNull();
  });

  it("ne promet ni prix, ni délai de réponse, ni agent autonome", () => {
    render(<Faq />);

    expect(screen.queryByText(/Pricing will be announced/)).toBeNull();
    expect(screen.queryByText(/within two business days/)).toBeNull();
    expect(screen.queryByText(/autonomous AI agents/)).toBeNull();
    expect(screen.queryByText(/early access/)).toBeNull();
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
  it("décrit le parcours réel en 4 étapes et un CTA sans essai payant", () => {
    render(<HowItWorks />);

    expect(screen.getByText("Offer definition")).toBeInTheDocument();
    expect(screen.getByText("Offer analysis")).toBeInTheDocument();
    expect(screen.getByText("Candidate search")).toBeInTheDocument();
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create your account/ })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByText("No subscription")).toBeInTheDocument();
  });

  it("ne promet ni essai payant, ni agents autonomes, ni télémétrie inventée", () => {
    render(<HowItWorks />);

    expect(screen.queryByText(/30-day full access/)).toBeNull();
    expect(screen.queryByText(/Start Free 30-Day Trial/)).toBeNull();
    expect(screen.queryByText(/ATS integration ready/)).toBeNull();
    expect(screen.queryByText(/Cancel anytime/)).toBeNull();
    expect(screen.queryByText(/Scanning 14\.8k PRs\/sec/)).toBeNull();
    expect(screen.queryByText(/Agent Orion/)).toBeNull();
    expect(screen.queryByText(/Agent Vega/)).toBeNull();
    expect(screen.queryByText(/Agent Hermes/)).toBeNull();
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
  it("conserve les principes, le showcase et le CTA contact", () => {
    render(<About />);

    expect(screen.getByText("The AI does not decide")).toBeInTheDocument();
    expect(screen.getByText("Criterion-by-Criterion Evaluation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contact us/ })).toHaveAttribute("href", "/contact");
  });

  it("ne promet ni agents fictifs, ni analyse de code, ni scores inventés", () => {
    render(<About />);

    expect(screen.queryByText(/Book Enterprise Demo/)).toBeNull();
    expect(screen.queryByText(/Orion/)).toBeNull();
    expect(screen.queryByText(/Vega/)).toBeNull();
    expect(screen.queryByText(/Nova/)).toBeNull();
    expect(screen.queryByText(/Hermes/)).toBeNull();
    expect(screen.queryByText(/GitHub/)).toBeNull();
    expect(screen.queryByText(/Vector Match/)).toBeNull();
    expect(screen.queryByText(/Candidate #/)).toBeNull();
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
