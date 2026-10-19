import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { AssessmentReview } from "@/features/matching/assessment-review";
import type { Matching } from "@/types/matching";
import { buildMatching } from "@/tests/helpers/matching-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

// Axios simulé (et non le module API) : la conversion formulaire → corps du PUT est réellement exécutée.
vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { baseURL: "http://api.test" } },
}));

import { api } from "@/lib/api/axios";

const getMock = vi.mocked(api.get);
const putMock = vi.mocked(api.put);
const PUBLIC_ID = "abcdefghijkl";
const FEEDBACK_URL = `/api/v1/matchings/offer/${PUBLIC_ID}/feedback`;

function httpError(status: number, detail?: string) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: detail ? { detail } : {} },
  });
}

const FINISHED: Matching = buildMatching({
  status: "done",
  assessmentFinished: true,
  sections: [
    {
      section: "required_skills",
      criteria: [
        { key: "skill:java", label: "Java", score: 80 },
        { key: "skill:kubernetes", label: "Kubernetes", score: 10 },
      ],
    },
    { section: "languages", criteria: [{ key: "language:english", label: "English", score: 60 }] },
  ],
  feedback: [{ criterionKey: "language:english", selfValue: 90, comment: "C1 certificate in 2024" }],
});

function renderWith(matching: Matching) {
  getMock.mockResolvedValue({ data: matching });
  return renderWithQueryClient(<AssessmentReview publicId={PUBLIC_ID} />);
}

const score = (label: string) => screen.getByRole("spinbutton", { name: `Your score for ${label}` });
const comment = (label: string) => screen.getByRole("textbox", { name: `Comment on ${label}` });

describe("AssessmentReview", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
  });

  it("stays hidden while the assessment is still open", async () => {
    renderWith({ ...FINISHED, assessmentFinished: false, feedback: [] });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
  });

  it("stays hidden during a re-evaluation and when no match exists (or the match is closed)", async () => {
    const { unmount } = renderWith({ ...FINISHED, status: "running" });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
    unmount();

    getMock.mockReset();
    getMock.mockRejectedValue(httpError(409, "The match is closed once your application is submitted."));
    renderWithQueryClient(<AssessmentReview publicId={PUBLIC_ID} />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
  });

  it("lists every criterion with its AI score and fields named after it, prefilled from the saved view", async () => {
    renderWith(FINISHED);

    const review = await screen.findByRole("region", { name: "Your assessment" });
    const skills = within(review).getByRole("region", { name: "Your view on Required skills" });
    expect(within(skills).getByText("Java")).toBeInTheDocument();
    expect(within(skills).getByText("80%")).toBeInTheDocument();
    expect(score("Java")).toHaveValue(null);
    expect(comment("Java")).toHaveValue("");
    expect(score("English")).toHaveValue(90);
    expect(comment("English")).toHaveValue("C1 certificate in 2024");
    expect(comment("English")).toHaveAttribute("maxLength", "2000");
    // Ni poids, ni score de section, ni moyenne, ni justification.
    expect(screen.queryByText(/weight|average|rationale/i)).not.toBeInTheDocument();
  });

  it("sends the full list: new scores, kept ones, a cleared score removed, a blank comment as null", async () => {
    putMock.mockResolvedValue({
      data: { items: [{ criterionKey: "skill:java", selfValue: 95, comment: "Java 21 daily" }] },
    });
    renderWith({
      ...FINISHED,
      feedback: [
        { criterionKey: "language:english", selfValue: 90, comment: "C1 certificate in 2024" },
        { criterionKey: "skill:kubernetes", selfValue: 40, comment: null },
      ],
    });
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("Java"), { target: { value: "95" } });
    fireEvent.change(comment("Java"), { target: { value: "  Java 21 daily  " } });
    fireEvent.change(score("English"), { target: { value: "" } });
    fireEvent.change(comment("English"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(FEEDBACK_URL, {
        items: [
          { criterionKey: "skill:java", selfValue: 95, comment: "Java 21 daily" },
          { criterionKey: "skill:kubernetes", selfValue: 40, comment: null },
        ],
      }),
    );
  });

  it("sends an empty list when every score is cleared", async () => {
    putMock.mockResolvedValue({ data: { items: [] } });
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("English"), { target: { value: "" } });
    fireEvent.change(comment("English"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(putMock).toHaveBeenCalledWith(FEEDBACK_URL, { items: [] }));
  });

  it.each([
    ["101", "above 100"],
    ["-1", "below 0"],
    ["50.5", "not a whole number"],
  ])("rejects a score of %s (%s) without saving", async (value) => {
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("Java"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a whole number between 0 and 100")).toBeInTheDocument();
    expect(score("Java")).toHaveAttribute("aria-invalid", "true");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("accepts both bounds, 0 and 100", async () => {
    putMock.mockResolvedValue({ data: { items: [] } });
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("Java"), { target: { value: "0" } });
    fireEvent.change(score("Kubernetes"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(putMock).toHaveBeenCalled());
    const body = putMock.mock.calls[0][1] as { items: { criterionKey: string; selfValue: number }[] };
    expect(body.items.map((item) => [item.criterionKey, item.selfValue])).toEqual([
      ["skill:java", 0],
      ["skill:kubernetes", 100],
      ["language:english", 90],
    ]);
  });

  it("rejects a comment over 2000 characters and a comment without a score", async () => {
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("English"), { target: { value: "85" } });
    fireEvent.change(comment("English"), { target: { value: "a".repeat(2001) } });
    fireEvent.change(comment("Java"), { target: { value: "I use it daily" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Comment must be 2000 characters or fewer")).toBeInTheDocument();
    expect(screen.getByText("Enter your score to keep this comment")).toBeInTheDocument();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("keeps Save disabled until something changes, busy while saving, then confirms", async () => {
    let resolve: (value: unknown) => void = () => {};
    putMock.mockReturnValue(new Promise((done) => (resolve = done)));
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(score("Java"), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true"));
    resolve({ data: { items: [{ criterionKey: "skill:java", selfValue: 70, comment: null }] } });

    expect(await screen.findByText("Assessment saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(score("Java")).toHaveValue(70);
  });

  it("shows the server detail when the view cannot be saved", async () => {
    putMock.mockRejectedValue(httpError(409, "Your application has already been submitted."));
    renderWith(FINISHED);
    await screen.findByRole("region", { name: "Your assessment" });

    fireEvent.change(score("Java"), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not save your assessment")).toBeInTheDocument();
    expect(screen.getByText("Your application has already been submitted.")).toBeInTheDocument();
    expect(screen.queryByText("Assessment saved")).not.toBeInTheDocument();
  });
});
