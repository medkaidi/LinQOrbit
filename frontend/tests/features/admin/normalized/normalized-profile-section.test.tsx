import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NormalizedProfileSection } from "@/features/admin/normalized/normalized-profile-section";
import type { AdminNormalizedProfile } from "@/types/admin";
import type { NormalizedCandidateProfile } from "@/types/normalized";

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

function makeEnvelope(
  overrides: Partial<AdminNormalizedProfile<NormalizedCandidateProfile>> = {},
): AdminNormalizedProfile<NormalizedCandidateProfile> {
  return {
    profileId: "profile-1",
    version: 2,
    schemaVersion: "2.0",
    validatedAt: "2026-10-10T12:00:00",
    jobStatus: "done",
    content: { title: "Senior Engineer" },
    ...overrides,
  };
}

function renderSection(
  overrides: Partial<{
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    profile: AdminNormalizedProfile<NormalizedCandidateProfile> | undefined;
  }> = {},
) {
  return render(
    <NormalizedProfileSection
      isLoading={overrides.isLoading ?? false}
      isError={overrides.isError ?? false}
      error={overrides.error}
      profile={overrides.profile}
      onRetry={() => {}}
    >
      {(content) => <p>content: {content.title}</p>}
    </NormalizedProfileSection>,
  );
}

describe("NormalizedProfileSection", () => {
  it("shows the envelope badges and the friendly content when the job is done", () => {
    renderSection({ profile: makeEnvelope() });

    expect(screen.getByText("Normalized profile")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("schema 2.0")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("validated 2026-10-10")).toBeInTheDocument();
    expect(screen.getByText("content: Senior Engineer")).toBeInTheDocument();
  });

  it("explains that no profile exists yet on a 404", () => {
    renderSection({ isError: true, error: axiosErrorWithStatus(404) });

    expect(
      screen.getByText(/No normalized profile has been produced yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry on any other error", () => {
    renderSection({ isError: true, error: axiosErrorWithStatus(500) });

    expect(screen.getByText("Unable to load the normalized profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports a failed job without rendering stale content", () => {
    renderSection({ profile: makeEnvelope({ jobStatus: "failed", content: null }) });

    expect(screen.getByText("Normalization failed")).toBeInTheDocument();
    expect(screen.queryByText(/content:/)).not.toBeInTheDocument();
  });

  it("shows a progress hint while the job is running", () => {
    renderSection({ profile: makeEnvelope({ jobStatus: "running", content: null }) });

    expect(
      screen.getByText(/The AI analysis is still running/),
    ).toBeInTheDocument();
  });

  it("reports a completed job that produced no content", () => {
    renderSection({ profile: makeEnvelope({ jobStatus: "done", content: null }) });

    expect(
      screen.getByText(/completed but produced no content/),
    ).toBeInTheDocument();
  });

  it("renders a loading indicator while fetching", () => {
    renderSection({ isLoading: true });

    expect(screen.getByText(/Loading normalized profile/)).toBeInTheDocument();
  });
});
