import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Dialog } from "@/components/ui/dialog";

function renderDialog(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <Dialog title="Dialog title" onClose={onClose} {...props}>
      <p>Dialog body</p>
    </Dialog>,
  );
  return onClose;
}

describe("Dialog", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders the title as the accessible name and the footer actions", () => {
    renderDialog({ description: "A subtitle", footer: <button type="button">Confirm</button> });

    expect(screen.getByRole("dialog", { name: "Dialog title" })).toBeInTheDocument();
    expect(screen.getByText("A subtitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("prefers ariaLabel over the visible title for the accessible name", () => {
    renderDialog({ ariaLabel: "Custom label" });

    expect(screen.getByRole("dialog", { name: "Custom label" })).toBeInTheDocument();
  });

  it("renders through a portal on document.body (immune to ancestor containing blocks)", () => {
    const { container } = render(
      <Dialog title="Portaled" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("closes on Escape", () => {
    const onClose = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop is clicked but not the card", () => {
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();

    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blocks Escape and backdrop close when not dismissable", () => {
    const onClose = renderDialog({ dismissable: false });

    fireEvent.keyDown(document, { key: "Escape" });
    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(overlay);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores it on unmount", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <Dialog title="Locked" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("is a centred card by default", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-xl");
    expect(dialog.parentElement).toHaveClass("items-center");
  });

  it("drops from the top as a wide scrolling curtain with placement top", () => {
    const onClose = renderDialog({ placement: "top" });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-6xl", "overflow-y-auto", "curtain-in");
    expect(dialog).not.toHaveClass("max-w-xl");
    expect(dialog.parentElement).toHaveClass("items-start");
    // Même shell : Échap ferme le rideau.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
