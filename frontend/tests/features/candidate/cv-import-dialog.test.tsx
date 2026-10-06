import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CvImportDialog } from "@/features/candidate/cv-import-dialog";
import { planCvImport, type CvImportRefs } from "@/features/candidate/cv-parsing";
import type { ParsedCv } from "@/types/candidate";

const cv: ParsedCv = {
  title: "Staff Engineer",
  summary: "I design platforms.",
  experiences: [],
  diplomas: [],
  skills: [
    { name: "Java", level: 4, yearsExperience: 5 },
    { name: "COBOL", level: 3, yearsExperience: 2 },
  ],
  languages: [],
  links: [],
};

const refs: CvImportRefs = {
  skills: [
    { id: "skill-java", name: "Java", skillType: "tech", category: "Programming Languages" },
    { id: "skill-k8s", name: "Kubernetes", skillType: "tech", category: "Cloud & DevOps" },
  ],
  languages: [],
  degrees: [],
  studyFields: [],
};

function renderDialog(overrides: Partial<Parameters<typeof CvImportDialog>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const props = {
    status: "ready" as const,
    cv,
    plan: planCvImport(cv, refs),
    skillOptions: refs.skills,
    onApply,
    onClose,
    ...overrides,
  };
  const view = render(<CvImportDialog {...props} />);
  return { ...view, onApply, onClose, props };
}

describe("CvImportDialog", () => {
  it("stays locked while the CV is being parsed", () => {
    const { onClose } = renderDialog({
      status: "parsing",
      statusLabel: "Parsing in progress…",
      cv: null,
      plan: null,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Parsing in progress…");
    expect(screen.queryByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape or backdrop click once the result is ready", () => {
    const { onClose } = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the parse failure with a close action", () => {
    const { onClose } = renderDialog({
      status: "error",
      errorMessage: "The AI service is unreachable.",
      cv: null,
      plan: null,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The AI service is unreachable.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies with mapped skills renamed to the catalog wording", () => {
    const { onApply } = renderDialog();

    fireEvent.click(screen.getByRole("combobox", { name: "COBOL" }));
    fireEvent.click(screen.getByRole("option", { name: "Kubernetes" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to my profile" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as ParsedCv;
    expect(applied.skills.map((skill) => skill.name)).toEqual(["Java", "Kubernetes"]);
    expect(applied.skills[1]).toEqual({ name: "Kubernetes", level: 3, yearsExperience: 2 });
    // Le résultat est importable : la compétence mappée sort du plan « skipped ».
    expect(planCvImport(applied, refs).skipped).toEqual([]);
  });

  it("applies the CV untouched when nothing is mapped", () => {
    const { onApply } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Apply to my profile" }));

    expect(onApply).toHaveBeenCalledWith(cv);
  });
});
