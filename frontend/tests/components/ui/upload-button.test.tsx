import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { UploadButton } from "@/components/ui/upload-button";

describe("UploadButton", () => {
  it("reports the selected PDF file", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <UploadButton label="Upload CV" accept=".pdf,application/pdf" onSelect={onSelect} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("accept", ".pdf,application/pdf");
    const file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it("disables itself and shows the busy label while an operation runs", () => {
    render(
      <UploadButton
        label="Upload CV"
        busyLabel="Analyzing…"
        busy
        onSelect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Analyzing…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the resting label when no busy label is given", () => {
    render(<UploadButton label="Upload CV" tone="secondary" busy onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Upload CV" })).toBeDisabled();
  });
});
