import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RecruiterProfileSection } from "@/features/recruiter/profile-section";
import type { RecruiterProfile } from "@/types/recruiter";

const useUpdateRecruiterMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-recruiter", () => ({
  useUpdateRecruiter: useUpdateRecruiterMock,
}));

const profile: RecruiterProfile = {
  id: "r1",
  headline: "Talent Lead at Nimbus Labs",
  bio: "Hiring engineers across Europe.",
};

function renderSection(overrides: Partial<RecruiterProfile> = profile) {
  return render(<RecruiterProfileSection profile={{ ...profile, ...overrides }} />);
}

describe("RecruiterProfileSection", () => {
  beforeEach(() => {
    useUpdateRecruiterMock.mockReturnValue({
      mutate: vi.fn(),
      isError: false,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
  });

  it("shows the headline and bio in read mode by default", () => {
    renderSection();

    expect(screen.getByText("Headline")).toBeInTheDocument();
    expect(screen.getByText("Talent Lead at Nimbus Labs")).toBeInTheDocument();
    expect(screen.getByText("Hiring engineers across Europe.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows Not provided when the profile is empty", () => {
    renderSection({ headline: null, bio: null });

    const notProvided = screen.getAllByText("Not provided");
    expect(notProvided).toHaveLength(2);
  });

  it("opens the editor on Edit and submits the update", async () => {
    const mutate = vi.fn((values, callbacks?: { onSuccess?: () => void }) => {
      callbacks?.onSuccess?.();
    });
    useUpdateRecruiterMock.mockReturnValue({
      mutate,
      isError: false,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const headline = screen.getByLabelText("Headline");
    expect(headline).toHaveValue("Talent Lead at Nimbus Labs");

    fireEvent.change(headline, { target: { value: "Head of Talent at Nimbus Labs" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ headline: "Head of Talent at Nimbus Labs" }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("discards the changes and returns to read mode", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Talent Lead at Nimbus Labs")).toBeInTheDocument();
  });
});
