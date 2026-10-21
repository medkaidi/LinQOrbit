import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

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

  it("renders five blue section bars, contests and links to the application detail", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard(),
          buildRecruiterApplicationCard({
            id: "application-2",
            candidate: { firstName: "Alan", lastName: "Turing" },
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
    expect(screen.getAllByText("View application")).toHaveLength(2);

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
    expect(screen.getByText("2 contested · avg gap 20 pts")).toBeInTheDocument();
    expect(screen.getByText("No AI assessment")).toBeInTheDocument();
    expect(screen.getByText("No contests")).toBeInTheDocument();

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
