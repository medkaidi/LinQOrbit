import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { CriterionReportDialog } from "@/features/application/criterion-report-dialog";
import type { RecruiterCriterionView } from "@/types/application";

const CRITERION: RecruiterCriterionView = {
  key: "skill:java",
  label: "Java",
  requirement: "Strong Java",
  weight: 4,
  score: 55,
  rationale: "Solid Java experience.",
};

function renderDialog(overrides: Partial<Parameters<typeof CriterionReportDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <CriterionReportDialog
      criterion={CRITERION}
      busy={false}
      error={null}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

/** Le sélecteur de motif est une liste déroulante : on choisit une option. */
function chooseReason(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Reason" }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("CriterionReportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("announces the internal, final nature of the report", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Report this assessment" });
    expect(within(dialog).getByText("Java")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/The score is not changed, the candidate never sees it/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/This report is final: it cannot be edited or withdrawn/),
    ).toBeInTheDocument();
  });

  it("requires a reason before sending", () => {
    const { onSubmit } = renderDialog();

    const send = screen.getByRole("button", { name: /Send report/ });
    expect(send).toBeDisabled();

    chooseReason("The score is wrong");
    expect(screen.getByRole("button", { name: /Send report/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      criterionKey: "skill:java",
      reason: "scoreIncorrect",
      comment: null,
    });
  });

  it("sends the comment when the reason carries one", () => {
    const { onSubmit } = renderDialog();

    chooseReason("The evidence is wrong");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The CV shows eight years of Java." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      criterionKey: "skill:java",
      reason: "evidenceWrong",
      comment: "The CV shows eight years of Java.",
    });
  });

  it("requires a comment for the reason other and says so", () => {
    const { onSubmit } = renderDialog();

    chooseReason("Other");
    expect(screen.getByText("Comment (required)")).toBeInTheDocument();
    expect(
      screen.getByText("A comment is required when the reason is other."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send report/ })).toBeDisabled();

    // Un commentaire en blanc ne compte pas.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /Send report/ })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "The offer is ambiguous." } });
    expect(screen.getByRole("button", { name: /Send report/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      criterionKey: "skill:java",
      reason: "other",
      comment: "The offer is ambiguous.",
    });
  });

  it("keeps the comment optional for the other reasons", () => {
    renderDialog();

    chooseReason("The profile was misunderstood");
    expect(screen.getByText("Comment (optional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send report/ })).toBeEnabled();
  });

  it("shows the backend error and keeps the dialog open", () => {
    const { onSubmit } = renderDialog({
      error: "You have already reported this criterion.",
    });

    expect(screen.getByText("You have already reported this criterion.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Report this assessment" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes without sending when cancelled", () => {
    const { onSubmit, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
