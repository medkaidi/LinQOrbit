import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  PublicJobArticle,
  type PublicJobArticleModel,
} from "@/features/job-offer/public-job-article";

function fullArticle(): PublicJobArticleModel {
  return {
    companyName: "Acme Inc.",
    title: "Backend Engineer",
    seniority: "Mid",
    location: "Paris, FR",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Hybrid",
    salary: "50,000 – 70,000 EUR per year",
    requiredExpYear: 3,
    publishedAt: null,
    expiresAt: null,
    description: "<p>Build APIs.</p>",
    skills: [
      { id: "s1", name: "Java", requirementType: "mandatory" },
      { id: "s2", name: "Docker", requirementType: "preferred" },
    ],
    languages: [{ id: "l1", name: "English", level: "B2" }],
    degreeLabels: ["Bachelor's degree"],
    studyFieldLabels: ["Computer Science"],
  };
}

describe("PublicJobArticle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the hero, the description and every section", () => {
    render(<PublicJobArticle article={fullArticle()} />);

    const hero = screen.getByRole("region", { name: "Job overview" });
    expect(within(hero).getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(within(hero).getByText("Acme Inc.")).toBeInTheDocument();
    expect(within(hero).getByText("Mid")).toBeInTheDocument();
    expect(within(hero).getByText("Paris, FR")).toBeInTheDocument();
    expect(within(hero).getByText("Permanent")).toBeInTheDocument();
    expect(within(hero).getByText("Full-time")).toBeInTheDocument();
    expect(within(hero).getByText("Hybrid")).toBeInTheDocument();
    expect(within(hero).getByText("50,000 – 70,000 EUR per year")).toBeInTheDocument();
    expect(within(hero).getByText("3+ yrs experience")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "About the role" })).toBeInTheDocument();
    expect(screen.getByText("Build APIs.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Skills & requirements" })).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("Preferred")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Languages" })).toBeInTheDocument();
    expect(screen.getByText(/English · B2/)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
  });

  it("renders the apply CTAs only when applyHref is provided", () => {
    const { rerender } = render(
      <PublicJobArticle
        article={fullArticle()}
        applyHref="/jobs/abcdefghijkl-backend-engineer/apply"
      />,
    );

    const applyLinks = screen.getAllByRole("link", { name: "Apply for this job" });
    expect(applyLinks).toHaveLength(2);
    for (const link of applyLinks) {
      expect(link).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer/apply");
    }

    rerender(<PublicJobArticle article={fullArticle()} />);
    expect(screen.queryByRole("link", { name: "Apply for this job" })).not.toBeInTheDocument();
  });

  it("renders related jobs with their public links", () => {
    render(
      <PublicJobArticle
        article={fullArticle()}
        relatedJobs={[
          {
            publicId: "zyxwvutsrqpo",
            slug: "frontend-engineer",
            title: "Frontend Engineer",
            salary: "40,000 – 55,000 EUR per year",
          },
        ]}
      />,
    );

    const related = screen.getByRole("region", { name: "More from this company" });
    expect(within(related).getByRole("link", { name: /Frontend Engineer/ })).toHaveAttribute(
      "href",
      "/jobs/zyxwvutsrqpo-frontend-engineer",
    );
    expect(within(related).getByText("40,000 – 55,000 EUR per year")).toBeInTheDocument();
    expect(within(related).getByRole("link", { name: "Browse all offers" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("renders only the full-width sections when embedded, without the overview header", () => {
    const { container, rerender } = render(<PublicJobArticle article={fullArticle()} />);
    // Défaut (fiche publique, prévisualisation recruteur) : en-tête + grille 8/4 inchangés.
    expect(screen.getByRole("region", { name: "Job overview" })).toBeInTheDocument();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(screen.getByText("Build APIs.").closest(".lg\\:col-span-8")).not.toBeNull();

    rerender(<PublicJobArticle article={fullArticle()} embedded />);

    // Plus d'en-tête (le bandeau l'affiche déjà) : ni titre de niveau 1, ni société en double.
    expect(screen.queryByRole("region", { name: "Job overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Acme Inc.")).not.toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByText("Build APIs.").closest(".lg\\:col-span-12")).not.toBeNull();
    expect(screen.getByText("Build APIs.").closest(".lg\\:col-span-8")).toBeNull();
  });

  it("shows the posted and expiry chips from the server dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    render(
      <PublicJobArticle
        article={{
          ...fullArticle(),
          publishedAt: "2026-10-12T12:00:00Z",
          expiresAt: "2026-10-18",
        }}
      />,
    );

    const hero = screen.getByRole("region", { name: "Job overview" });
    expect(within(hero).getByText("Posted 3 days ago")).toBeInTheDocument();
    expect(within(hero).getByText("Expires in 3 days")).toBeInTheDocument();
  });

  it("hides empty sections without breaking the hero", () => {
    render(
      <PublicJobArticle
        article={{
          companyName: null,
          title: "Backend Engineer",
          seniority: null,
          location: null,
          contractType: null,
          employmentType: null,
          workMode: null,
          salary: null,
          requiredExpYear: null,
          publishedAt: null,
          expiresAt: null,
          description: null,
          skills: [],
          languages: [],
          degreeLabels: [],
          studyFieldLabels: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("No company")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About the role" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Skills & requirements" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Languages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Education" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "More from this company" }),
    ).not.toBeInTheDocument();
  });
});
