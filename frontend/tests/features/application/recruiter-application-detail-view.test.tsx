import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { RecruiterApplicationDetailView } from "@/features/application/recruiter-application-detail-view";
import {
  decideRecruiterApplication,
  downloadRecruiterApplicationCv,
  getRecruiterApplication,
  listRecruiterApplications,
} from "@/lib/api/application.api";
import {
  buildRecruiterApplicationDetail,
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

const detailMock = vi.mocked(getRecruiterApplication);
const decideMock = vi.mocked(decideRecruiterApplication);
const downloadMock = vi.mocked(downloadRecruiterApplicationCv);

function renderDetail() {
  return renderWithQueryClient(
    <RecruiterApplicationDetailView
      offerId={RECRUITER_OFFER_ID}
      applicationId={RECRUITER_APPLICATION_ID}
    />,
  );
}

describe("RecruiterApplicationDetailView", () => {
  beforeEach(() => {
    detailMock.mockReset();
    decideMock.mockReset();
    downloadMock.mockReset();
    vi.mocked(listRecruiterApplications).mockReset();
  });

  it("shows recruiter answers with preferred, AI rationale, clarifications, contests and CV", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());

    renderDetail();

    expect(await screen.findByRole("heading", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByText("Application for Backend Engineer · Acme Labs")).toBeInTheDocument();
    expect(screen.getByText("3 answers")).toBeInTheDocument();
    expect(screen.getByText("Why this role?")).toBeInTheDocument();
    expect(screen.getByText("I love APIs")).toBeInTheDocument();
    expect(screen.getByText("On site")).toBeInTheDocument();
    expect(screen.getAllByText("Preferred")).toHaveLength(2);
    expect(screen.getAllByText("Java")).toHaveLength(3);
    expect(screen.getByText("Python")).toBeInTheDocument();

    expect(screen.getByText("Solid Java experience, but the depth is partial.")).toBeInTheDocument();
    expect(screen.getByText("Why did you choose Java?")).toBeInTheDocument();
    expect(screen.getByText("Because I use it daily.")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("AI 80 · Candidate 70 · Gap 10")).toBeInTheDocument();
    expect(screen.getByText("AI 60 · Candidate 90 · Gap 30")).toBeInTheDocument();
    expect(screen.getByText("I write English docs every day.")).toBeInTheDocument();
    expect(screen.getByText("grace-hopper-cv.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download CV" }));
    await waitFor(() =>
      expect(downloadMock).toHaveBeenCalledWith(
        RECRUITER_OFFER_ID,
        RECRUITER_APPLICATION_ID,
        "grace-hopper-cv.pdf",
      ),
    );
  });

  it("confirms an accept decision before recording it", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    decideMock.mockResolvedValue(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    const dialog = screen.getByRole("dialog", { name: "Accept this application?" });
    expect(dialog).toBeInTheDocument();
    expect(decideMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Accept application" }));

    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith(
        RECRUITER_OFFER_ID,
        RECRUITER_APPLICATION_ID,
        "accepted",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Accept this application?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps decisions server-gated and surfaces a conflict without inventing state", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail({ canDecide: false }));

    renderDetail();

    await screen.findByRole("heading", { name: "Grace Hopper" });
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("shows a 409 conflict when another tab already decided", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    decideMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { detail: "This application has already been decided." },
      },
    });

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject application" }));

    expect(await screen.findByText("Decision failed")).toBeInTheDocument();
    expect(screen.getByText("This application has already been decided.")).toBeInTheDocument();
  });
});
