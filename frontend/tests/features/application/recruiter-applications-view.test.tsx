import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { RecruiterApplicationsView } from "@/features/application/recruiter-applications-view";
import {
  decideRecruiterApplication,
  downloadRecruiterApplicationCv,
  getRecruiterApplication,
  listRecruiterApplications,
} from "@/lib/api/application.api";
import {
  buildRecruiterApplicationCard,
  buildRecruiterApplicationPage,
  RECRUITER_APPLICATION_ID,
  RECRUITER_OFFER_ID,
} from "@/tests/helpers/recruiter-application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/application.api", () => ({
  decideRecruiterApplication: vi.fn(),
  downloadRecruiterApplicationCv: vi.fn(),
  getRecruiterApplication: vi.fn(),
  listRecruiterApplications: vi.fn(),
}));

const listMock = vi.mocked(listRecruiterApplications);

function renderView() {
  return renderWithQueryClient(<RecruiterApplicationsView offerId={RECRUITER_OFFER_ID} />);
}

describe("RecruiterApplicationsView", () => {
  beforeEach(() => {
    listMock.mockReset();
    vi.mocked(decideRecruiterApplication).mockReset();
    vi.mocked(downloadRecruiterApplicationCv).mockReset();
    vi.mocked(getRecruiterApplication).mockReset();
  });

  it("renders five section scores, contests and links to the application detail", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard(),
          buildRecruiterApplicationCard({
            id: "application-2",
            candidate: { firstName: "Alan", lastName: "Turing", title: null },
            assessmentAvailable: false,
            sections: [
              { section: "requiredSkills", score: null },
              { section: "preferredSkills", score: null },
              { section: "languages", score: null },
              { section: "experience", score: null },
              { section: "education", score: null },
            ],
            contestedCount: 0,
            averageGap: null,
          }),
        ],
        total: 2,
      }),
    );

    renderView();

    expect(await screen.findByText("2 applications")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer · Acme Labs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grace Hopper" })).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );
    expect(screen.getByRole("link", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("View application")).toHaveLength(2);
    // L'action est un lien de navigation interne vers le détail de la candidature.
    expect(screen.getAllByRole("link", { name: "View application" })[0]).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );

    // Cinq barres, valeurs affichées, section de tri par défaut = date : aucune mise en avant.
    for (const label of [
      "Required skills",
      "Preferred skills",
      "Languages",
      "Experience",
      "Education",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const score of ["60", "75", "80", "85", "90"]) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    const contestedPanel = screen.getByRole("group", {
      name: "Contests: 2 contested · avg gap 20 pts",
    });
    expect(within(contestedPanel).getByText("2 contested")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("Average gap")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("20 pts")).toBeInTheDocument();
    expect(screen.getByText("No AI assessment")).toBeInTheDocument();
    // Sans évaluation, le bloc contestations n'a pas de sens : « No AI assessment » suffit.
    expect(screen.queryByText("No contests")).not.toBeInTheDocument();

    expect(listMock).toHaveBeenCalledWith(
      RECRUITER_OFFER_ID,
      { status: "submitted", sort: "submittedAt", direction: "asc", page: 0 },
      { signal: expect.any(AbortSignal) },
    );
    expect(screen.getByRole("button", { name: "Submitted" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("omits a missing or blank candidate title instead of rendering a placeholder", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            candidate: { firstName: "Alan", lastName: "Turing", title: "   " },
          }),
        ],
      }),
    );

    renderView();

    expect(await screen.findByRole("link", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.queryByText("Senior Backend Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("Not provided")).not.toBeInTheDocument();
  });

  it("colors the rounded score with the band of the displayed value", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            contestedCount: 0,
            averageGap: null,
            sections: [
              { section: "requiredSkills", score: 69.5 },
              { section: "preferredSkills", score: null },
              { section: "languages", score: null },
              { section: "experience", score: null },
              { section: "education", score: null },
            ],
          }),
        ],
        total: 1,
      }),
    );

    renderView();

    expect(await screen.findByText("70")).toHaveClass("text-success-text");
  });

  it("renders No contests and Not evaluated for an assessed application without gaps", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            contestedCount: 0,
            averageGap: null,
            sections: [
              { section: "requiredSkills", score: 60 },
              { section: "preferredSkills", score: null },
              { section: "languages", score: 80 },
              { section: "experience", score: 85 },
              { section: "education", score: 90 },
            ],
          }),
        ],
        total: 1,
      }),
    );

    renderView();

    expect(await screen.findByText("1 application")).toBeInTheDocument();
    const noContestsPanel = screen.getByRole("group", { name: "Contests: No contests" });
    expect(within(noContestsPanel).getByText("No contests")).toBeInTheDocument();
    expect(within(noContestsPanel).getByText("All scores uncontested")).toBeInTheDocument();
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.queryByText("No AI assessment")).not.toBeInTheDocument();
  });

  it("keeps the contest count and reports an unavailable gap when no average exists", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [buildRecruiterApplicationCard({ contestedCount: 3, averageGap: null })],
        total: 1,
      }),
    );

    renderView();

    expect(await screen.findByText("1 application")).toBeInTheDocument();
    const contestedPanel = screen.getByRole("group", { name: "Contests: 3 contested" });
    expect(within(contestedPanel).getByText("3 contested")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("Not available")).toBeInTheDocument();
  });

  it("filters by tab, sorts by section and contests, and starts from the empty state", async () => {
    listMock.mockImplementation(async (_offerId, params) =>
      params?.status === "accepted"
        ? buildRecruiterApplicationPage({ items: [], total: 0 })
        : buildRecruiterApplicationPage(),
    );

    renderView();
    await screen.findByText("Grace Hopper");

    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));

    expect(await screen.findByText("No accepted applications yet.")).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "accepted", sort: "submittedAt", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Submitted" }));
    await screen.findByText("Grace Hopper");

    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Required skills" }));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "requiredSkills", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Desc" }));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "requiredSkills", direction: "desc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Contests" }));
    expect(screen.getByText("Fixed order")).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "contests", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });
});
