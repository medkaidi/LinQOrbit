import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NormalizedSheetCta } from "@/features/admin/normalized/normalized-sheet-cta";
import type { AdminNormalizedProfile } from "@/types/admin";
import type { NormalizedCandidateProfile } from "@/types/normalized";

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

const profile: AdminNormalizedProfile<NormalizedCandidateProfile> = {
  profileId: "np-1",
  version: 3,
  schemaVersion: "2.0",
  validatedAt: "2026-10-10T12:00:00",
  jobStatus: "done",
  content: { title: "Mathematician" },
};

function renderCta(
  overrides: Partial<{
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    profile: AdminNormalizedProfile<NormalizedCandidateProfile> | undefined;
  }> = {},
  onOpen = vi.fn(),
) {
  const result = render(
    <NormalizedSheetCta
      isLoading={overrides.isLoading ?? false}
      isError={overrides.isError ?? false}
      error={overrides.error}
      profile={overrides.profile}
      onRetry={() => {}}
      onOpen={onOpen}
    />,
  );
  return { ...result, onOpen };
}

describe("NormalizedSheetCta", () => {
  it("offers an Open sheet button that opens the drawer, with the identity banner", () => {
    const { onOpen } = renderCta({ profile });

    expect(screen.getByRole("heading", { name: "Normalized sheet" })).toBeInTheDocument();
    const openButton = screen.getByRole("button", { name: "Open sheet" });
    fireEvent.click(openButton);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Profile ID")).toBeInTheDocument();
    expect(screen.getByText("np-1")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByText("2026-10-10 12:00")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("explains a never-validated profile without offering the button", () => {
    renderCta({ isError: true, error: axiosErrorWithStatus(404) });

    expect(
      screen.getByText(/No normalized profile has been produced yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open sheet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("surfaces a load error with a retry", () => {
    renderCta({ isError: true, error: axiosErrorWithStatus(500) });

    expect(screen.getByText("Unable to load the normalized profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open sheet" })).not.toBeInTheDocument();
  });

  it("shows a loading state while the profile is fetched", () => {
    renderCta({ isLoading: true });

    expect(screen.getByText(/Loading normalized sheet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open sheet" })).not.toBeInTheDocument();
  });
});
