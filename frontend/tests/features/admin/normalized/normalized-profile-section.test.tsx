import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

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
    actions: ReactNode;
    panel: ReactNode;
  }> = {},
) {
  return render(
    <NormalizedProfileSection
      isLoading={overrides.isLoading ?? false}
      isError={overrides.isError ?? false}
      error={overrides.error}
      profile={overrides.profile}
      onRetry={() => {}}
      actions={overrides.actions}
      panel={overrides.panel}
    >
      {(content) => <p>content: {content.title}</p>}
    </NormalizedProfileSection>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
});

describe("NormalizedProfileSection", () => {
  it("shows the identity banner and the friendly content when the job is done", () => {
    renderSection({ profile: makeEnvelope() });

    expect(screen.getByText("Normalized profile")).toBeInTheDocument();
    // Bandeau d'identité réel : cellules clé/valeur.
    expect(screen.getByText("Profile ID")).toBeInTheDocument();
    expect(screen.getByText("profile-1")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.getByText("2026-10-10 12:00")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("content: Senior Engineer")).toBeInTheDocument();
  });

  it("renders the JSON actions when a content exists", () => {
    renderSection({ profile: makeEnvelope() });

    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeInTheDocument();
  });

  it("renders no JSON action while the content is missing", () => {
    renderSection({ profile: makeEnvelope({ jobStatus: "failed", content: null }) });

    expect(screen.queryByRole("button", { name: "Copy JSON" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download JSON" })).not.toBeInTheDocument();
  });

  it("copies the displayed content as pretty JSON and confirms with Copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderSection({ profile: makeEnvelope() });

    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify({ title: "Senior Engineer" }, null, 2),
    );
    expect(await screen.findByRole("button", { name: "JSON copied to clipboard" })).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("downloads the displayed content as versioned JSON", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });
    renderSection({ profile: makeEnvelope() });

    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(downloadedName).toBe("normalized-profile-v2.json");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("renders the extra actions slot (history button from the page)", () => {
    renderSection({
      profile: makeEnvelope(),
      actions: <button type="button">History</button>,
    });

    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("renders the panel region at the top of the body (open history)", () => {
    renderSection({
      profile: makeEnvelope(),
      panel: <p>history panel</p>,
    });

    const panel = screen.getByText("history panel");
    const content = screen.getByText("content: Senior Engineer");
    // La région du panneau précède le contenu friendly dans le corps.
    expect(panel.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
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
    expect(screen.getByText("failed")).toBeInTheDocument();
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
