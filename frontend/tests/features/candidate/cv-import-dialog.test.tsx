import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CvImportDialog } from "@/features/candidate/cv-import-dialog";
import { planCvImport, type CvImportRefs } from "@/features/candidate/cv-parsing";
import type { ParsedCv } from "@/types/candidate";

const { suggestState } = vi.hoisted(() => ({
  suggestState: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as unknown,
  },
}));

vi.mock("@/hooks/use-candidate-profile", () => ({
  useSuggestSkills: () => suggestState,
}));

beforeEach(() => {
  suggestState.mutate.mockReset();
  suggestState.isPending = false;
  suggestState.isError = false;
  suggestState.error = null;
});

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

  it("sends the unmapped skills for review and confirms once the server accepts", () => {
    suggestState.mutate.mockImplementation(
      (_names: string[], options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Send 1 unresolved skill for review" }));

    expect(suggestState.mutate).toHaveBeenCalledWith(["COBOL"], expect.anything());
    expect(screen.getByText(/Sent for review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send 1 unresolved skill/ })).not.toBeInTheDocument();
  });

  it("surfaces the backend error while keeping the send action available", () => {
    suggestState.isError = true;
    suggestState.error = {
      isAxiosError: true,
      response: { data: { detail: "Too many suggestions per request." } },
    };
    renderDialog();

    expect(screen.getByRole("alert")).toHaveTextContent("Too many suggestions per request.");
    expect(screen.getByRole("button", { name: "Send 1 unresolved skill for review" })).toBeEnabled();
  });
});
