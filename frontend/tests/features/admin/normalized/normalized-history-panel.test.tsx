import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NormalizedHistoryPanel } from "@/features/admin/normalized/normalized-history-panel";
import type { AdminNormalizedProfile } from "@/types/admin";
import type { NormalizedCandidateProfile } from "@/types/normalized";

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

function makeVersion(
  version: number,
  overrides: Partial<AdminNormalizedProfile<NormalizedCandidateProfile>> = {},
): AdminNormalizedProfile<NormalizedCandidateProfile> {
  return {
    profileId: `np-${version}`,
    version,
    schemaVersion: "2.0",
    validatedAt: `2026-10-0${version}T12:00:00`,
    jobStatus: "done",
    content: { title: `Title v${version}` },
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<{
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    versions: AdminNormalizedProfile<NormalizedCandidateProfile>[];
    currentVersion: number | undefined;
    selectedVersion: number | undefined;
    onSelect: (version: number) => void;
  }> = {},
) {
  return render(
    <NormalizedHistoryPanel
      isLoading={overrides.isLoading ?? false}
      isError={overrides.isError ?? false}
      error={overrides.error}
      onRetry={() => {}}
      versions={overrides.versions ?? [makeVersion(3), makeVersion(2)]}
      currentVersion={overrides.currentVersion ?? 3}
      selectedVersion={overrides.selectedVersion ?? 3}
      onSelect={overrides.onSelect ?? (() => {})}
    />,
  );
}

describe("NormalizedHistoryPanel", () => {
  it("lists every version with its schema, date, status and current marker", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument();
    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("v3");
    expect(rows[0]).toHaveTextContent("Current");
    expect(rows[0]).toHaveTextContent("schema 2.0");
    expect(rows[0]).toHaveTextContent("2026-10-03 12:00");
    expect(rows[0]).toHaveTextContent("done");
    expect(rows[1]).toHaveTextContent("v2");
    expect(rows[1]).not.toHaveTextContent("Current");
  });

  it("marks the displayed version via aria-pressed", () => {
    renderPanel({ currentVersion: 3, selectedVersion: 2 });

    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveAttribute("aria-pressed", "false");
    expect(rows[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("reports the selected version on a row click", () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });

    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("shows a loading state while the history is fetched", () => {
    renderPanel({ isLoading: true, versions: [] });

    expect(screen.getByText(/Loading version history/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers a retry on a history load error", () => {
    renderPanel({ isError: true, error: axiosErrorWithStatus(500), versions: [] });

    expect(screen.getByText("Unable to load the version history")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("explains an empty history", () => {
    renderPanel({ versions: [] });

    expect(screen.getByText(/No version has been produced yet/)).toBeInTheDocument();
  });
});
