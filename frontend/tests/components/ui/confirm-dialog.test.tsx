import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function renderConfirm(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="Delete this draft offer?"
      message="This cannot be undone."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders the title, message and default labels", () => {
    renderConfirm();

    expect(screen.getByRole("dialog", { name: "Delete this draft offer?" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("confirms and cancels through the footer actions", () => {
    const { onConfirm, onCancel } = renderConfirm({ confirmLabel: "Delete" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("closes on Escape and on a backdrop click", () => {
    const { onCancel } = renderConfirm();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();

    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("blocks dismissal and disables Cancel while busy", () => {
    const { onCancel } = renderConfirm({ busy: true });

    fireEvent.keyDown(document, { key: "Escape" });
    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(overlay);

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("aria-busy", "true");
  });
});
