import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { VIEW_MODE_STORAGE_KEY, useViewModeStore } from "@/stores/view-mode-store";

describe("ViewModeToggle", () => {
  beforeEach(() => {
    useViewModeStore.setState({ mode: "candidate" });
    localStorage.removeItem(VIEW_MODE_STORAGE_KEY);
  });

  it("defaults to candidate", () => {
    render(<ViewModeToggle />);

    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Recruiter" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches and persists the mode when Recruiter is clicked", () => {
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(screen.getByRole("button", { name: "Recruiter" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(useViewModeStore.getState().mode).toBe("recruiter");

    const persisted = JSON.parse(localStorage.getItem(VIEW_MODE_STORAGE_KEY) ?? "null");
    expect(persisted?.state?.mode).toBe("recruiter");
  });
});
