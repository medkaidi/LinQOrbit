import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CvUploadChoiceDialog } from "@/features/candidate/cv-upload-choice-dialog";

function renderDialog(overrides: Partial<Parameters<typeof CvUploadChoiceDialog>[0]> = {}) {
  const onSaveOnly = vi.fn();
  const onAnalyze = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <CvUploadChoiceDialog
      fileName="cv.pdf"
      busy={false}
      error={null}
      onSaveOnly={onSaveOnly}
      onAnalyze={onAnalyze}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...view, onSaveOnly, onAnalyze, onCancel };
}

describe("CvUploadChoiceDialog", () => {
  it("explains both outcomes for the selected file", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("What should we do with this CV?")).toBeInTheDocument();
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save the file only" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze and update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("routes each action to its callback", () => {
    const { onSaveOnly, onAnalyze, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save the file only" }));
    expect(onSaveOnly).toHaveBeenCalledTimes(1);
    expect(onAnalyze).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Analyze and update" }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("locks every action and the Escape key while the file is being saved", () => {
    const { onCancel } = renderDialog({ busy: true });

    expect(screen.getByRole("button", { name: "Save the file only" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze and update" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save the file only" })).toHaveAttribute("aria-busy", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("closes on Escape when no save is running", () => {
    const { onCancel } = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows the save error without closing the choice", () => {
    renderDialog({ error: "The file is too large." });

    expect(screen.getByRole("status")).toHaveTextContent("Could not save this CV");
    expect(screen.getByRole("status")).toHaveTextContent("The file is too large.");
    expect(screen.getByRole("button", { name: "Analyze and update" })).toBeInTheDocument();
  });
});
