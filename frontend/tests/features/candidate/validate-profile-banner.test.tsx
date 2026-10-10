import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, validateProfile: vi.fn() };
});

import { validateProfile } from "@/lib/api/candidate.api";
import type { CandidateProfile } from "@/types/candidate";
import { ValidateProfileBanner } from "@/features/candidate/validate-profile-banner";

const mockedValidateProfile = vi.mocked(validateProfile);

function buildProfile(
  hasUnvalidatedChanges: boolean,
  normalizationFailed = false,
  normalizationInProgress = false,
): CandidateProfile {
  return {
    about: {
      title: null,
      targetPosition: null,
      bio: null,
      yearsOfExperience: null,
      searchStatus: null,
    },
    experiences: [],
    projects: [],
    diplomas: [],
    skills: [],
    languages: [],
    links: [],
    completionPercentage: 0,
    hasUnvalidatedChanges,
    normalizationFailed,
    normalizationInProgress,
  };
}

function renderBanner(profile: CandidateProfile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ValidateProfileBanner profile={profile} />
    </QueryClientProvider>,
  );
}

describe("ValidateProfileBanner", () => {
  beforeEach(() => {
    mockedValidateProfile.mockReset();
    mockedValidateProfile.mockResolvedValue(undefined);
  });

  it("stays hidden when every change has already been validated", () => {
    const { container } = renderBanner(buildProfile(false));

    expect(container).toBeEmptyDOMElement();
    expect(mockedValidateProfile).not.toHaveBeenCalled();
  });

  it("asks for validation while the profile has unvalidated changes", async () => {
    renderBanner(buildProfile(true));

    expect(await screen.findByText("Profile changes pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /validate profile/i })).toBeEnabled();
    expect(mockedValidateProfile).not.toHaveBeenCalled();
  });

  it("disables the action while the validation is running", async () => {
    let resolveValidation: () => void = () => {};
    mockedValidateProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveValidation = resolve;
      }),
    );
    renderBanner(buildProfile(true));

    const button = await screen.findByRole("button", { name: /validate profile/i });
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(button).toBeDisabled();

    resolveValidation();
    expect(await screen.findByText("Profile validated")).toBeInTheDocument();
  });

  it("posts the validation and confirms once it succeeds", async () => {
    renderBanner(buildProfile(true));

    fireEvent.click(await screen.findByRole("button", { name: /validate profile/i }));

    await waitFor(() => expect(mockedValidateProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Profile validated")).toBeInTheDocument();
    expect(screen.queryByText("Profile changes pending")).not.toBeInTheDocument();
  });

  it("surfaces the API error and keeps the banner available for a retry", async () => {
    mockedValidateProfile.mockRejectedValue(new Error("boom"));
    renderBanner(buildProfile(true));

    fireEvent.click(await screen.findByRole("button", { name: /validate profile/i }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.getByText("Profile changes pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /validate profile/i })).toBeEnabled();
  });

  it("reports a failed last attempt with a generic message, without any error detail", async () => {
    renderBanner(buildProfile(false, true));

    expect(await screen.findByText("Last validation attempt failed")).toBeInTheDocument();
    expect(
      screen.getByText("We could not finish analyzing your profile. You can try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Profile changes pending")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /validate again/i })).toBeInTheDocument();
  });

  it("retries the validation straight from the failure banner", async () => {
    renderBanner(buildProfile(false, true));

    fireEvent.click(await screen.findByRole("button", { name: /validate again/i }));

    await waitFor(() => expect(mockedValidateProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Profile validated")).toBeInTheDocument();
  });

  it("prefers the failure notice over the pending-changes notice when both apply", async () => {
    renderBanner(buildProfile(true, true));

    expect(await screen.findByText("Last validation attempt failed")).toBeInTheDocument();
    expect(screen.queryByText("Profile changes pending")).not.toBeInTheDocument();
  });

  it("shows the analyzing state while a normalization job is in progress, without any action", async () => {
    renderBanner(buildProfile(false, false, true));

    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(
      screen.getByText("Your profile is being analyzed in the background. This can take a few seconds."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mockedValidateProfile).not.toHaveBeenCalled();
  });

  it("hides the pending-changes notice while an analysis is already running", async () => {
    renderBanner(buildProfile(true, false, true));

    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.queryByText("Profile changes pending")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("prefers the analyzing notice over the failure notice when both apply", async () => {
    renderBanner(buildProfile(false, true, true));

    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.queryByText("Last validation attempt failed")).not.toBeInTheDocument();
  });
});
