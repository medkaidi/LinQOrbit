import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NormalizedCandidateView } from "@/features/admin/normalized/normalized-candidate-view";
import type { NormalizedCandidateProfile } from "@/types/normalized";

const fullProfile: NormalizedCandidateProfile = {
  schemaVersion: "3",
  title: "Senior Backend Engineer",
  summary: "Backend specialist with a focus on JVM platforms.",
  yearsOfExperience: 8,
  seniority: "senior",
  targetRole: "Staff Engineer",
  searchStatus: "open to offers",
  location: { city: "Paris", country: "FR" },
  experiences: [
    {
      positionTitle: "Backend Engineer",
      companyName: "Acme",
      startDate: "2020-09",
      endDate: null,
      description: "Built the matching pipeline.",
      domain: "Recruitment",
      technologies: ["Java", "Spring"],
      achievements: ["Cut latency by 40%"],
    },
  ],
  projects: [
    {
      name: "Orbit CLI",
      role: "Author",
      context: "open_source",
      startDate: "2022-01",
      endDate: "2023-06",
      description: "A tiny CLI.",
      technologies: ["Rust"],
    },
  ],
  diplomas: [
    {
      title: "MSc Computer Science",
      institution: "Sorbonne",
      degreeLabel: "Master",
      studyFieldLabel: "Computer Science",
      startDate: "2014-09",
      endDate: "2016-06",
      origin: "declared",
    },
  ],
  languages: [
    { name: "English", level: "C1", origin: "declared" },
    { name: "Spanish", level: "B1", origin: "inferred" },
  ],
  certifications: [
    { name: "AWS SAA", issuer: "AWS", issuedAt: "2023-04", origin: "declared" },
  ],
  links: [{ label: "GitHub", url: "https://github.com/ada" }],
  skills: [
    {
      name: "Java",
      category: "programming_language",
      level: 5,
      yearsExperience: 8,
      origin: "declared",
      evidence: [{ source: "experience", index: 0 }],
    },
    {
      name: "Leadership",
      category: "soft_skill",
      level: null,
      origin: "inferred",
    },
    {
      name: "Product sense",
      category: "soft_skill",
      origin: "inferred",
      evidence: [{ source: "bio", index: null }],
    },
  ],
};

describe("NormalizedCandidateView", () => {
  it("renders the canonical content as friendly sections, never as raw JSON", () => {
    const { container } = render(<NormalizedCandidateView profile={fullProfile} />);

    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Senior · 8 yrs experience · Paris, FR · open to offers · Staff Engineer/)).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText(/Backend Engineer · Acme/)).toBeInTheDocument();
    expect(screen.getByText("Sep 2020 – Present")).toBeInTheDocument();
    expect(screen.getByText(/Cut latency by 40%/)).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Orbit CLI · Author")).toBeInTheDocument();
    expect(screen.getByText("Open source")).toBeInTheDocument();
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText(/MSc Computer Science · Sorbonne/)).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("English · C1")).toBeInTheDocument();
    expect(screen.getByText("Spanish · B1")).toBeInTheDocument();
    expect(screen.getByText("AWS SAA")).toBeInTheDocument();
    expect(screen.getByText("GitHub:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://github.com/ada" })).toHaveAttribute(
      "href",
      "https://github.com/ada",
    );
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText(/Programming language/)).toBeInTheDocument();
    expect(screen.getByText("Level 5/5")).toBeInTheDocument();
    expect(screen.getAllByText(/8 yrs/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Evidence: experience #0/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence: bio/)).toBeInTheDocument();
    // Provenance : langues, diplôme et certification déclarés ; inférés ailleurs.
    expect(screen.getAllByText("Declared").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("Inferred").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/Soft skill/).length).toBeGreaterThanOrEqual(2);
    // Jamais de JSON brut.
    expect(container.textContent).not.toContain("{");
    expect(container.textContent).not.toContain('"schemaVersion"');
  });

  it("tolerates a sparse profile without crashing", () => {
    render(<NormalizedCandidateView profile={{ title: "Bare profile" }} />);

    expect(screen.getByText("Bare profile")).toBeInTheDocument();
    expect(
      screen.getByText(/The normalized profile is empty/),
    ).toBeInTheDocument();
  });

  it("shows an explicit empty state when the content object holds nothing", () => {
    render(<NormalizedCandidateView profile={{}} />);

    expect(
      screen.getByText(/The normalized profile is empty — the AI service found no content to extract\./),
    ).toBeInTheDocument();
  });

  it("labels an inferred skill without level or evidence", () => {
    render(
      <NormalizedCandidateView
        profile={{
          skills: [{ name: "Communication", category: "soft_skill", origin: "inferred" }],
        }}
      />,
    );

    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Soft skill")).toBeInTheDocument();
  });
});
