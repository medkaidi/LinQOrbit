import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  PublicJobArticle,
  type PublicJobArticleModel,
} from "@/features/job-offer/public-job-article";

const fullArticle: PublicJobArticleModel = {
  companyName: "Acme Inc.",
  title: "Backend Engineer",
  meta: ["Mid", "Hybrid · Paris, FR", "Permanent"],
  description: "<p>Build APIs.</p>",
  skills: [{ id: "s1", name: "Java", requirementType: "mandatory" }],
  languages: [{ id: "l1", name: "English", level: "B2" }],
  degreeLabels: ["Bachelor's degree"],
  studyFieldLabels: ["Computer Science"],
};

describe("PublicJobArticle", () => {
  it("renders the header, description and every section", () => {
    render(<PublicJobArticle article={fullArticle} />);

    expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByText("Mid · Hybrid · Paris, FR · Permanent")).toBeInTheDocument();
    expect(screen.getByText("Build APIs.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("· required")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Languages" })).toBeInTheDocument();
    expect(screen.getByText(/English · B2/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
  });

  it("hides empty sections without breaking the header", () => {
    render(
      <PublicJobArticle
        article={{
          companyName: null,
          title: "Backend Engineer",
          meta: [],
          description: null,
          skills: [],
          languages: [],
          degreeLabels: [],
          studyFieldLabels: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skills" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Languages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Education" })).not.toBeInTheDocument();
  });
});
