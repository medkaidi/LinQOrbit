import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CvImportError, CvImportPreview, CvUploadButton } from "@/features/candidate/cv-import";
import { planCvImport, type CvImportRefs } from "@/features/candidate/cv-parsing";
import type { ParsedCv } from "@/types/candidate";

const parsedCv: ParsedCv = {
  title: "Staff Engineer",
  summary: "I design platforms.",
  experiences: [
    {
      positionTitle: "Staff Engineer",
      companyName: "Globex",
      companyCountry: "France",
      startDate: "2022-05",
      endDate: null,
      description: "Platform ownership.",
    },
  ],
  diplomas: [],
  skills: [
    { name: "Java", level: 4, yearsExperience: 7 },
    { name: "COBOL", level: 3, yearsExperience: 1 },
  ],
  languages: [],
  links: [{ label: "GitHub", url: "https://github.com/ada" }],
};

const refs: CvImportRefs = {
  skills: [{ id: "skill-java", name: "Java", skillType: "tech", category: "Programming Languages" }],
  languages: [],
  degrees: [],
  studyFields: [],
};

describe("CvUploadButton", () => {
  it("reports the selected PDF file", () => {
    const onSelect = vi.fn();
    const { container } = render(<CvUploadButton isParsing={false} onSelect={onSelect} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it("disables itself while the CV is being analyzed", () => {
    const onSelect = vi.fn();
    render(<CvUploadButton isParsing={true} onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: "Analyzing…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("CvImportError", () => {
  it("announces the backend message as an alert", () => {
    render(<CvImportError message="The AI service is unreachable." />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This CV could not be read");
    expect(alert).toHaveTextContent("The AI service is unreachable.");
  });
});

describe("CvImportPreview", () => {
  const plan = planCvImport(parsedCv, refs);

  it("shows what the CV contains and what will be skipped", () => {
    render(
      <CvImportPreview cv={parsedCv} plan={plan} onApply={() => {}} onDiscard={() => {}} />,
    );

    expect(screen.getByRole("heading", { name: "Review your CV import" })).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer · Globex")).toBeInTheDocument();
    expect(screen.getByText("May 2022 — Present")).toBeInTheDocument();
    expect(screen.getByText("Java · Level 4 · 7 yrs")).toBeInTheDocument();
    expect(screen.getByText(/COBOL — Not in your skill list/)).toBeInTheDocument();
    expect(screen.getAllByText(/\d+ found/)).toHaveLength(5);
  });

  it("applies or discards the import through its buttons", () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    render(
      <CvImportPreview cv={parsedCv} plan={plan} onApply={onApply} onDiscard={onDiscard} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Apply to my profile" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("blocks applying until the reference lists are ready", () => {
    render(
      <CvImportPreview
        cv={parsedCv}
        plan={plan}
        applyDisabled
        applyHint="Loading reference lists…"
        onApply={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Apply to my profile" })).toBeDisabled();
    expect(screen.getByText("Loading reference lists…")).toBeInTheDocument();
  });

  it("offers a searchable mapping select for skills outside the catalog", () => {
    const onMappingChange = vi.fn();
    render(
      <CvImportPreview
        cv={parsedCv}
        plan={plan}
        skillOptions={refs.skills}
        mappings={{}}
        onMappingChange={onMappingChange}
        onApply={() => {}}
        onDiscard={() => {}}
      />,
    );

    // La compétence hors catalogue quitte la liste « skipped » pour la zone de mapping.
    expect(screen.getByText("Unmapped skills")).toBeInTheDocument();
    expect(screen.queryByText(/COBOL — Not in your skill list/)).not.toBeInTheDocument();
    expect(screen.queryByText("Skipped from this import")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "COBOL" }));
    fireEvent.click(screen.getByRole("option", { name: "Java" }));

    expect(onMappingChange).toHaveBeenCalledWith("COBOL", "skill-java");
  });

  it("keeps the plain skipped list when no mapping is offered", () => {
    render(<CvImportPreview cv={parsedCv} plan={plan} onApply={() => {}} onDiscard={() => {}} />);

    expect(screen.queryByText("Unmapped skills")).not.toBeInTheDocument();
    expect(screen.getByText(/COBOL — Not in your skill list/)).toBeInTheDocument();
  });
});
