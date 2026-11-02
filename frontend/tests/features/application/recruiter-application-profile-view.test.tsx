import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecruiterApplicationProfileView } from "@/features/application/recruiter-application-profile-view";
import { getRecruiterApplicationProfile } from "@/lib/api/application.api";
import {
  buildRecruiterCandidateProfile,
  RECRUITER_APPLICATION_ID,
  RECRUITER_OFFER_ID,
} from "@/tests/helpers/recruiter-application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/application.api", () => ({
  decideRecruiterApplication: vi.fn(),
  downloadRecruiterApplicationCv: vi.fn(),
  getRecruiterApplication: vi.fn(),
  getRecruiterApplicationProfile: vi.fn(),
  listRecruiterApplications: vi.fn(),
  reportCriterion: vi.fn(),
}));

const useJobOfferMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-job-offers", () => ({ useJobOffer: useJobOfferMock }));

const profileMock = vi.mocked(getRecruiterApplicationProfile);

function httpError(status: number, detail: string) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { detail },
  } as AxiosResponse);
}

function renderView() {
  return renderWithQueryClient(
    <RecruiterApplicationProfileView
      offerId={RECRUITER_OFFER_ID}
      applicationId={RECRUITER_APPLICATION_ID}
    />,
  );
}

describe("RecruiterApplicationProfileView", () => {
  beforeEach(() => {
    profileMock.mockReset();
    useJobOfferMock.mockReturnValue({ data: { id: RECRUITER_OFFER_ID, title: "Backend Engineer" } });
  });

  it("shows the full profile of the applicant with the contact details", async () => {
    profileMock.mockResolvedValue(buildRecruiterCandidateProfile());

    renderView();

    // L'e-mail est la donnée la plus tardive : il prouve que le profil est chargé.
    // Il apparaît deux fois : dans la carte « Contact » (lien actionnable) et
    // dans la section « Personal Information » du profil candidat.
    const emailNodes = await screen.findAllByText("grace.hopper@example.com");
    const emailLink = emailNodes.find((node) => node.tagName === "A");
    expect(emailLink).toHaveAttribute("href", "mailto:grace.hopper@example.com");
    const phoneNodes = screen.getAllByText("+1 555 000 0000");
    const phoneLink = phoneNodes.find((node) => node.tagName === "A");
    expect(phoneLink).toHaveAttribute("href", "tel:+15550000000");
    // Profil professionnel : mêmes sections que la vue du candidat.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Grace Hopper");
    expect(screen.getByText("Builds payment systems")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
  });

  it("links back to the application", async () => {
    profileMock.mockResolvedValue(buildRecruiterCandidateProfile());

    renderView();

    const back = await screen.findByRole("link", { name: /Back to application/ });
    expect(back).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );
  });

  it("explains a missing application without offering a retry", async () => {
    profileMock.mockRejectedValue(httpError(404, "Application not found."));

    renderView();

    await screen.findByText("Could not load this candidate profile");
    expect(
      screen.getByText("This candidate profile is no longer available for this application."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("offers a retry on a transient failure", async () => {
    profileMock.mockRejectedValue(httpError(500, "boom"));

    renderView();

    await screen.findByText("Could not load this candidate profile");
    const retry = screen.getByRole("button", { name: "Retry" });
    profileMock.mockResolvedValue(buildRecruiterCandidateProfile());
    fireEvent.click(retry);

    await waitFor(() => expect(profileMock).toHaveBeenCalledTimes(2));
  });
});
