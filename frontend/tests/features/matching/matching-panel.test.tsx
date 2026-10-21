import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { MatchingPanel } from "@/features/matching/matching-panel";
import { getCurrentMatching, startMatching, streamMatchingStatus } from "@/lib/api/matching.api";
import type { Matching } from "@/types/matching";
import { buildClarification, buildMatching } from "@/tests/helpers/matching-fixtures";
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
  return buildMatching(overrides);
}

const DONE: Matching = matching({
  status: "done",
  // Évaluation close : aucune question en attente (le panneau n'affiche que les scores).
  assessmentFinished: true,
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

    const runButton = await screen.findByRole("button", { name: "Run the match" });
    expect(runButton).toHaveClass("text-blue-deep");
    fireEvent.click(runButton);

    await waitFor(() => expect(startMock).toHaveBeenCalledWith(PUBLIC_ID));
    expect(await screen.findByText("Analyzing…")).toBeInTheDocument();
    expect(screen.getByText(/being compared with this offer/)).toBeInTheDocument();
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

    expect(await screen.findByText("Analyzing…")).toBeInTheDocument();
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
    expect(within(required).getByRole("meter", { name: "Kubernetes" })).toHaveAttribute("aria-valuenow", "0");
    // Barre « tube » bleue (T-89) : l'orange n'est plus la couleur des données.
    const javaMeter = within(required).getByRole("meter", { name: "Java" });
    expect(javaMeter.firstElementChild?.className).toContain("bg-blue-deep");
    // En-têtes de section : rang + compteur de critères, même anatomie que la revue (T-89).
    expect(within(required).getByText("2 criteria")).toBeInTheDocument();
    const languages = screen.getByRole("region", { name: "Languages" });
    expect(within(languages).getByText("100%")).toBeInTheDocument();
    expect(within(languages).getByText("1 criterion")).toBeInTheDocument();
    // Aucune section vide n'est rendue, aucun score de section n'est montré au candidat.
    expect(screen.queryByRole("region", { name: "Education" })).not.toBeInTheDocument();
    expect(screen.queryByText(/weight/i)).not.toBeInTheDocument();
  });

  it("lets the candidate run a failed analysis again", async () => {
    getMock.mockResolvedValue(matching({ status: "failed" }));
    startMock.mockResolvedValue(matching({ status: "pending" }));

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("The analysis failed")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Run the match again" });
    expect(retryButton).toHaveClass("text-blue-deep");
    fireEvent.click(retryButton);

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Analyzing…")).toBeInTheDocument();
  });

  it("runs the preparation first, and never starts the match when it fails", async () => {
    getMock.mockRejectedValue(httpError(404));
    startMock.mockResolvedValue(matching());
    const prepare = vi.fn().mockRejectedValueOnce(httpError(404, "This job offer is no longer available.")).mockResolvedValueOnce(undefined);

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} prepare={prepare} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));

    expect(await screen.findByText("This job offer is no longer available.")).toBeInTheDocument();
    expect(startMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Run the match" }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith(PUBLIC_ID));
    expect(prepare).toHaveBeenCalledTimes(2);
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

  it("keeps the previous scores on screen while a re-evaluation runs", async () => {
    getMock.mockResolvedValue({ ...DONE, status: "pending", assessmentFinished: false, clarification: null });

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    // Statut d'analyse en pastille d'en-tête (T-89) + message en texte muet.
    expect(await screen.findByText("Analyzing…")).toBeInTheDocument();
    expect(screen.getByText(/previous ones until the new analysis ends/)).toBeInTheDocument();
    // Les scores précédents restent visibles pendant la réévaluation, suivie par le flux SSE.
    expect(screen.getByRole("region", { name: "Required skills" })).toBeInTheDocument();
    // Le message de première analyse (sans scores) ne double pas celui de la réévaluation.
    expect(screen.queryByText(/being compared with this offer/)).not.toBeInTheDocument();
    await waitFor(() => expect(streamMock).toHaveBeenCalledWith(PUBLIC_ID, expect.any(Function), expect.anything()));
  });

  it("never renders the evaluation rationale or weights, even if the payload carried them", async () => {
    const leaky = {
      ...DONE,
      sections: [
        {
          section: "required_skills" as const,
          score: 73,
          weight: 0.6,
          criteria: [{ key: "skill:java", label: "Java", score: 90, weight: 5, rationale: "Strong Java background" }],
        },
      ],
    } as unknown as Matching;
    getMock.mockResolvedValue(leaky);

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByText("90%")).toBeInTheDocument();
    expect(screen.queryByText("Strong Java background")).not.toBeInTheDocument();
    expect(screen.queryByText(/73/)).not.toBeInTheDocument();
    expect(screen.queryByText(/weight/i)).not.toBeInTheDocument();
  });

  it("leaves the questions and the closing action to the journey, showing only the scores", async () => {
    getMock.mockResolvedValue({ ...DONE, assessmentFinished: false, clarification: buildClarification() });

    renderWithQueryClient(<MatchingPanel publicId={PUBLIC_ID} />);

    expect(await screen.findByRole("region", { name: "Required skills" })).toBeInTheDocument();
    // La clarification vit dans le contenu central du parcours depuis la refonte D6.
    expect(screen.queryByRole("region", { name: "AI clarification" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish the assessment" })).not.toBeInTheDocument();
  });
});
