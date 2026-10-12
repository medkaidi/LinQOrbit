import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useViewModeStore } from "@/stores/view-mode-store";

const pushMock = vi.hoisted(() => vi.fn());
const pathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock(),
}));

function switchDialog() {
  return screen.queryByRole("dialog", { name: "Switch to the recruiter workspace" });
}

describe("ViewModeToggle", () => {
  beforeEach(() => {
    pushMock.mockClear();
    pathnameMock.mockReturnValue("/dashboard");
    useViewModeStore.setState({ mode: "candidate" });
  });

  it("marks Candidate active on dashboard routes", () => {
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

  it("marks Recruiter active on recruiter routes", () => {
    pathnameMock.mockReturnValue("/recruiter/offers/new");
    render(<ViewModeToggle />);

    expect(screen.getByRole("button", { name: "Recruiter" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("opens the confirmation modal instead of navigating when leaving the candidate profile", () => {
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(switchDialog()).toBeInTheDocument();
    expect(screen.getByText(/free for a 14-day trial/i)).toBeInTheDocument();
  });

  it("navigates to the recruiter workspace only after confirming", () => {
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to recruiter" }));

    expect(pushMock).toHaveBeenCalledWith("/recruiter");
    expect(switchDialog()).not.toBeInTheDocument();
  });

  it("closes the modal without navigating on cancel", () => {
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(switchDialog()).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("closes the modal without navigating on Escape", () => {
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(switchDialog()).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates back to the dashboard when Candidate is clicked", () => {
    pathnameMock.mockReturnValue("/recruiter");
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Candidate" }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does not reopen the modal when Recruiter is already active", () => {
    pathnameMock.mockReturnValue("/recruiter");
    render(<ViewModeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Recruiter" }));

    expect(switchDialog()).not.toBeInTheDocument();
  });
});
