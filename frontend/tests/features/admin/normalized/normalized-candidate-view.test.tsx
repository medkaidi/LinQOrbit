import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
  it("renders the sheet as lettered sections with a spec grid, table, timeline and rail", () => {
    const { container } = render(<NormalizedCandidateView profile={fullProfile} />);

    // A. Identity : titre canonique + spec-grid (cellules réelles, pas de header bits).
    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("open to offers")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    expect(screen.getByText("Backend specialist with a focus on JVM platforms.")).toBeInTheDocument();

    // Sections lettrées.
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText("Career timeline")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Languages" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Links" })).toBeInTheDocument();

    // B. Tableau compétences : name + category, level, years, evidence, origin.
    expect(screen.getAllByText("Java").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Programming language/)).toBeInTheDocument();
    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getAllByText(/8 yrs/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("experience #0")).toBeInTheDocument();
    expect(screen.getByText("bio")).toBeInTheDocument();

    // C. Timeline fusionnée : expérience, projet, diplôme triés et typés.
    expect(screen.getByText(/Backend Engineer · Acme/)).toBeInTheDocument();
    expect(screen.getByText("Sep 2020 – Present")).toBeInTheDocument();
    expect(screen.getByText(/Cut latency by 40%/)).toBeInTheDocument();
    expect(screen.getByText("Orbit CLI · Author")).toBeInTheDocument();
    expect(screen.getByText("Open source")).toBeInTheDocument();
    expect(screen.getByText(/MSc Computer Science · Sorbonne/)).toBeInTheDocument();

    // D. Langues, E. certifications, F. liens.
    expect(screen.getByText("English · C1")).toBeInTheDocument();
    expect(screen.getByText("Spanish · B1")).toBeInTheDocument();
    expect(screen.getByText("AWS SAA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://github.com/ada" })).toHaveAttribute(
      "href",
      "https://github.com/ada",
    );

    // Rail : provenance réelle (4 declared / 3 inferred) + couverture 7/7.
    expect(screen.getByText("Provenance")).toBeInTheDocument();
    const provenance = screen.getByText("Provenance").closest("section") as HTMLElement;
    expect(within(provenance).getByText("4")).toBeInTheDocument();
    expect(within(provenance).getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "57");
    expect(screen.getByText("57% declared")).toBeInTheDocument();
    expect(screen.getByText("Sheet coverage")).toBeInTheDocument();
    expect(screen.getByText("7/7")).toBeInTheDocument();

    // Provenance déclarée/inférée conservée.
    expect(screen.getAllByText("Declared").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("Inferred").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/Soft skill/).length).toBeGreaterThanOrEqual(2);

    // Jamais de JSON brut.
    expect(container.textContent).not.toContain("{");
    expect(container.textContent).not.toContain('"schemaVersion"');
  });

  it("merges experiences, projects and diplomas into one timeline sorted by start date desc", () => {
    render(<NormalizedCandidateView profile={fullProfile} />);

    const timeline = screen.getByRole("heading", { name: "Career timeline" }).closest("section");
    expect(timeline).not.toBeNull();
    const items = within(timeline as HTMLElement).getAllByRole("listitem");
    const titles = items.map((item) => item.textContent ?? "");
    // Projet 2022 > expérience 2020 > diplôme 2014.
    expect(titles.findIndex((text) => text.includes("Orbit CLI"))).toBeLessThan(
      titles.findIndex((text) => text.includes("Backend Engineer")),
    );
    expect(titles.findIndex((text) => text.includes("Backend Engineer"))).toBeLessThan(
      titles.findIndex((text) => text.includes("MSc Computer Science")),
    );
    // Chaque entrée porte son type.
    expect(within(timeline as HTMLElement).getByText("Project")).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText("Experience")).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText("Diploma")).toBeInTheDocument();
  });

  it("tolerates a sparse profile without crashing", () => {
    render(<NormalizedCandidateView profile={{ title: "Bare profile" }} />);

    expect(screen.getByText("Bare profile")).toBeInTheDocument();
    expect(screen.getByText(/The normalized profile is empty/)).toBeInTheDocument();
    // Les cellules absentes ne rendent pas de tiret inventé (section A vide).
    const overview = screen.getByText("Bare profile").closest("section") as HTMLElement;
    expect(within(overview).queryByText("—")).not.toBeInTheDocument();
  });

  it("shows an explicit empty state when the content object holds nothing", () => {
    render(<NormalizedCandidateView profile={{}} />);

    expect(
      screen.getByText(/The normalized profile is empty — the AI service found no content to extract\./),
    ).toBeInTheDocument();
    expect(screen.getByText("0/7")).toBeInTheDocument();
    expect(screen.getByText(/No origin data/)).toBeInTheDocument();
  });

  it("labels an inferred skill without level or evidence", () => {
    render(
      <NormalizedCandidateView
        profile={{
          skills: [{ name: "Communication", category: "soft_skill", origin: "inferred" }],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Soft skill")).toBeInTheDocument();
    const skillsSection = screen.getByRole("heading", { name: "Skills" }).closest("section") as HTMLElement;
    expect(within(skillsSection).getByText("Inferred")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("1/7")).toBeInTheDocument();
  });
});
