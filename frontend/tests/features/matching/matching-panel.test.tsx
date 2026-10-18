import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { MatchingPanel } from "@/features/matching/matching-panel";
import { getCurrentMatching, startMatching, streamMatchingStatus } from "@/lib/api/matching.api";
import type { Matching } from "@/types/matching";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/matching.api", () => ({
  getCurrentMatching: vi.fn(),
  startMatching: vi.fn(),
  streamMatchingStatus: vi.fn(),
}));

const getMock = vi.mocked(getCurrentMatching);
const startMock = vi.mocked(startMatching);
const streamMock = vi.mocked(streamMatchingStatus);
const PUBLIC_ID = "abcdefghijkl";

function httpError(status: number, detail?: string) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: detail ? { detail } : {} },
  });
}

function matching(overrides: Partial<Matching> = {}): Matching {
  return { matchingId: "m-1", status: "pending", sections: [], ...overrides };
}

const DONE: Matching = matching({
  status: "done",
  sections: [
    {
      section: "required_skills",
      criteria: [
        { key: "skill:java", label: "Java", score: 90 },
        { key: "skill:kubernetes", label: "Kubernetes", score: 0 },
      ],
    },
    { section: "languages", criteria: [{ key: "language:english", label: "English", score: 100 }] },
  ],
});

describe("MatchingPanel", () => {
  beforeEach(() => {
    getMock.mockReset();
    startMock.mockReset();
    streamMock.mockReset();
    // Par défaut : un flux qui reste ouvert sans rien pousser.
    streamMock.mockImplementation(() => new Promise(() => {}));
  });

  it("offers to run the match when none was started (404 is not an error)", async () => {
    getMock.mockRejectedValue(httpError(404));
    startMock.mockResolvedValue(matching());

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));

    await waitFor(() => expect(startMock).toHaveBeenCalledWith(PUBLIC_ID));
    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.queryByText("Could not load your match")).not.toBeInTheDocument();
  });

  it("updates by itself when the server pushes the end of the analysis — no Refresh button", async () => {
    getMock.mockResolvedValueOnce(matching({ status: "running" })).mockResolvedValueOnce(DONE);
    let push: ((event: { matchingId: string; status: "done" }) => void) | undefined;
    streamMock.mockImplementation((_publicId, onStatus) => {
      push = onStatus as typeof push;
      return new Promise(() => {});
    });

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    await waitFor(() => expect(streamMock).toHaveBeenCalledWith(PUBLIC_ID, expect.any(Function), expect.anything()));
    push?.({ matchingId: "m-1", status: "done" });

    expect(await screen.findByRole("region", { name: "Required skills" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("does not listen to the stream once the analysis is over", async () => {
    getMock.mockResolvedValue(DONE);

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByRole("region", { name: "Required skills" })).toBeInTheDocument();
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("shows only the score of each criterion, section by section", async () => {
    getMock.mockResolvedValue(DONE);

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    const required = await screen.findByRole("region", { name: "Required skills" });
    expect(within(required).getByText("Java")).toBeInTheDocument();
    expect(within(required).getByText("90%")).toBeInTheDocument();
    expect(within(required).getByRole("progressbar", { name: "Kubernetes" })).toHaveAttribute("aria-valuenow", "0");
    expect(within(screen.getByRole("region", { name: "Languages" })).getByText("100%")).toBeInTheDocument();
    // Aucune section vide n'est rendue, aucun score de section n'est montré au candidat.
    expect(screen.queryByRole("region", { name: "Education" })).not.toBeInTheDocument();
    expect(screen.queryByText(/weight/i)).not.toBeInTheDocument();
  });

  it("lets the candidate run a failed analysis again", async () => {
    getMock.mockResolvedValue(matching({ status: "failed" }));
    startMock.mockResolvedValue(matching({ status: "pending" }));

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("The analysis failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run the match again" }));

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
  });

  it("shows the server detail when the match cannot be run", async () => {
    getMock.mockRejectedValue(httpError(404));
    startMock.mockRejectedValue(httpError(409, "Validate your profile before running the match."));

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));

    expect(await screen.findByText("Validate your profile before running the match.")).toBeInTheDocument();
  });

  it("shows a read error other than 404 as an error", async () => {
    getMock.mockRejectedValue(httpError(409, "The match is closed once your application is submitted."));

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("Could not load your match")).toBeInTheDocument();
    expect(screen.getByText("The match is closed once your application is submitted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run the match" })).not.toBeInTheDocument();
  });

  it("tells when a finished analysis has no criterion", async () => {
    getMock.mockResolvedValue(matching({ status: "done", sections: [] }));

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("This offer has no criterion to compare yet.")).toBeInTheDocument();
  });
});
