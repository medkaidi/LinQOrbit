import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NormalizedOfferView } from "@/features/admin/normalized/normalized-offer-view";
import type { NormalizedJobOffer } from "@/types/normalized";

const fullOffer: NormalizedJobOffer = {
  schemaVersion: "2",
  title: "Senior Backend Engineer",
  alternateTitles: ["Backend Developer", "Server-side Engineer"],
  domain: "Software Engineering",
  contractType: "permanent",
  workTime: "full_time",
  seniority: "senior",
  workMode: "hybrid",
  location: { city: "Paris", country: "FR" },
  salary: { min: 70000, max: 90000, currency: "EUR", period: "year" },
  summary: "Own the matching pipeline end to end.",
  companyPitch: "We build tools for recruiters.",
  description: "First paragraph.\nSecond paragraph.",
  responsibilities: [
    {
      text: "Design REST APIs.",
      importance: "mandatory",
      weight: 5,
      domain: "Backend",
      technologies: ["Spring Boot"],
    },
    { text: "Mentor juniors.", importance: "optional", weight: 2 },
  ],
  requiredSkills: [
    {
      name: "Java",
      category: "programming_language",
      weight: 5,
      level: 4,
      minYears: 5,
      minYearsSource: "declared",
      origin: "declared",
      evidence: [{ source: "responsibility", index: 0 }],
    },
  ],
  preferredSkills: [
    {
      name: "Kafka",
      category: "tool",
      weight: 2,
      minYears: 3,
      minYearsSource: "inferred",
      origin: "inferred",
    },
  ],
  requiredYears: 5,
  requiredYearsSource: "declared",
  requiredDegrees: [{ label: "Master", source: "declared" }],
  requiredStudyFields: [{ label: "Computer Science", source: "inferred" }],
  languages: [
    { name: "English", level: "B2", required: true, origin: "declared" },
    { name: "French", level: "B1", required: false, origin: "inferred" },
  ],
  certifications: [{ name: "AWS SAA", issuer: "AWS" }],
  benefits: ["Remote-friendly", "Health insurance"],
};

describe("NormalizedOfferView", () => {
  it("renders the canonical offer as friendly sections with resolved labels, never raw JSON", () => {
    const { container } = render(<NormalizedOfferView offer={fullOffer} />);

    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Software Engineering · Permanent · Full-time · Senior · Hybrid · Paris, FR · 70,000 – 90,000 EUR per year/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Also known as: Backend Developer, Server-side Engineer/)).toBeInTheDocument();
    expect(screen.getByText("Own the matching pipeline end to end.")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("We build tools for recruiters.")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText(/First paragraph\./)).toBeInTheDocument();
    expect(screen.getByText("Responsibilities")).toBeInTheDocument();
    expect(screen.getByText("Design REST APIs.")).toBeInTheDocument();
    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("Backend · Spring Boot")).toBeInTheDocument();
    expect(screen.getByText("Mentor juniors.")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText("Required skills")).toBeInTheDocument();
    expect(screen.getAllByText(/5\+ yrs/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Evidence: responsibility #0/)).toBeInTheDocument();
    expect(screen.getByText("Preferred skills")).toBeInTheDocument();
    expect(screen.getByText("Kafka")).toBeInTheDocument();
    expect(screen.getByText("3+ yrs (inferred)")).toBeInTheDocument();
    expect(screen.getByText("Required experience")).toBeInTheDocument();
    expect(screen.getByText("5+ yrs total")).toBeInTheDocument();
    expect(screen.getByText("Education requirements")).toBeInTheDocument();
    expect(screen.getByText("Degree: Master")).toBeInTheDocument();
    expect(screen.getByText("Field of study: Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("English · B2")).toBeInTheDocument();
    expect(screen.getByText("French · B1 (nice-to-have)")).toBeInTheDocument();
    expect(screen.getByText("Certifications")).toBeInTheDocument();
    expect(screen.getByText("AWS SAA")).toBeInTheDocument();
    expect(screen.getByText("Benefits")).toBeInTheDocument();
    expect(screen.getByText("· Remote-friendly")).toBeInTheDocument();
    expect(screen.getByText("· Health insurance")).toBeInTheDocument();
    // Poids 1-5 : responsibility pivale, skill déclaré, skills secondaires.
    expect(screen.getAllByText(/Weight 5\/5/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Weight 2\/5/).length).toBeGreaterThanOrEqual(2);
    // Provenance déclarée (skill, expérience totale, diplôme, langue) vs inférée.
    expect(screen.getAllByText("Declared").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("Inferred").length).toBeGreaterThanOrEqual(3);
    // Jamais de JSON brut.
    expect(container.textContent).not.toContain("{");
    expect(container.textContent).not.toContain('"schemaVersion"');
  });

  it("tolerates a sparse offer without crashing", () => {
    render(<NormalizedOfferView offer={{ title: "Bare offer" }} />);

    expect(screen.getByText("Bare offer")).toBeInTheDocument();
    expect(screen.getByText(/The normalized offer is empty/)).toBeInTheDocument();
  });

  it("shows an explicit empty state when the content object holds nothing", () => {
    render(<NormalizedOfferView offer={{}} />);

    expect(
      screen.getByText(/The normalized offer is empty — the AI service found no content to extract\./),
    ).toBeInTheDocument();
  });
});
