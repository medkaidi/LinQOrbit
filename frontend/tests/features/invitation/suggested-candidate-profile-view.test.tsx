import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SuggestedCandidateProfileView } from "@/features/invitation/suggested-candidate-profile-view";
import { getSuggestedCandidateProfile, inviteSuggestedCandidate } from "@/lib/api/invitation.api";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import type { CandidateProfile } from "@/types/candidate";
import type { SuggestedCandidate, SuggestedCandidateProfile } from "@/types/invitation";

vi.mock("@/lib/api/invitation.api", () => ({
  getSuggestedCandidateProfile: vi.fn(),
  inviteSuggestedCandidate: vi.fn(),
}));

const useJobOfferMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-job-offers", () => ({ useJobOffer: useJobOfferMock }));

const profileMock = vi.mocked(getSuggestedCandidateProfile);
const inviteMock = vi.mocked(inviteSuggestedCandidate);

const profile: CandidateProfile = {
  about: {
    title: "Backend Engineer",
    targetPosition: null,
    bio: "I build payment systems.",
    yearsOfExperience: 7,
    searchStatus: "open_to_work",
  },
  experiences: [
    {
      id: "e1",
      positionTitle: "Tech Lead",
      description: "Led the platform team.",
      startDate: "2020-01-01",
      endDate: null,
      companyName: "Acme Corp",
      companyCountry: "FR",
    },
  ],
  projects: [],
  diplomas: [],
  skills: [{ skillId: "s1", name: "Java", skillType: "tech", level: 4, yearsExperience: 7 }],
  languages: [],
  links: [],
  completionPercentage: 70,
  hasUnvalidatedChanges: false,
  normalizationFailed: false,
  normalizationInProgress: false,
  analysisOutdated: false,
};

function card(overrides: Partial<SuggestedCandidate> = {}): SuggestedCandidate {
  return {
    id: "s1",
    rank: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Backend Engineer",
    seniority: "senior",
    yearsOfExperience: 7,
    country: "FR",
    skills: [],
    status: "suggested",
    ...overrides,
  };
}

function detail(overrides: Partial<SuggestedCandidateProfile> = {}): SuggestedCandidateProfile {
  return {
    card: card(),
    currentCity: "Lyon",
    currentCountry: "FR",
    canInvite: true,
    profile,
    ...overrides,
  };
}

function httpError(status: number, detail: string) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { detail },
  } as AxiosResponse);
}

function renderView() {
  return renderWithQueryClient(<SuggestedCandidateProfileView offerId="o1" suggestionId="s1" />);
}

describe("SuggestedCandidateProfileView", () => {
  beforeEach(() => {
    profileMock.mockReset();
    inviteMock.mockReset();
    useJobOfferMock.mockReturnValue({ data: { id: "o1", title: "Senior Backend Engineer" } });
  });

  it("shows the name, the position, the offer and the full read-only profile", async () => {
    profileMock.mockResolvedValue(detail());

    renderView();

    expect(await screen.findByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByText("Suggested for Senior Backend Engineer")).toBeInTheDocument();
    expect(profileMock).toHaveBeenCalledWith("o1", "s1");
    // Nom + monogramme dans l'en-tête et dans la section About.
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AL").length).toBeGreaterThan(0);
    expect(screen.getByText("Acme Corp · France")).toBeInTheDocument();
    expect(screen.getByText("I build payment systems.")).toBeInTheDocument();
    expect(screen.getByText("Lyon, France")).toBeInTheDocument();
    // Lecture seule : aucun CTA d'édition.
    expect(screen.queryByRole("link", { name: /Add experience/ })).not.toBeInTheDocument();
  });

  it("keeps the Email and Phone cells but shows Not available, never a contact detail", async () => {
    profileMock.mockResolvedValue(detail());

    renderView();

    await screen.findByRole("heading", { name: "Experience" });
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getAllByText("Not available")).toHaveLength(2);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("breadcrumbs back to the list and links the back button to it", async () => {
    profileMock.mockResolvedValue(detail());

    renderView();

    await screen.findByRole("heading", { name: "Experience" });
    expect(screen.getByRole("link", { name: "Suggested candidates" })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions",
    );
    expect(screen.getByRole("link", { name: /Back to candidates/ })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions",
    );
  });

  it("invites after a confirmation, then shows the Invited state", async () => {
    profileMock.mockResolvedValueOnce(detail());
    profileMock.mockResolvedValue(detail({ card: card({ status: "invited" }) }));
    inviteMock.mockResolvedValue(card({ status: "invited" }));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    expect(inviteMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Invite this candidate to apply?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Invite$/ }));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledWith("o1", "s1"));
    expect(await screen.findByText("Invited")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it("does not invite when the confirmation is cancelled", async () => {
    profileMock.mockResolvedValue(detail());

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(inviteMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers no invitation to a member without management rights", async () => {
    profileMock.mockResolvedValue(detail({ canInvite: false }));

    renderView();

    await screen.findByRole("heading", { name: "Experience" });
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it.each([
    ["invited", "Invited"],
    ["applied", "Applied"],
  ] as const)("shows %s instead of the invitation button", async (status, label) => {
    profileMock.mockResolvedValue(detail({ card: card({ status }) }));

    renderView();

    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it("explains that the consent was withdrawn on a 404, without any retry or profile", async () => {
    profileMock.mockRejectedValue(httpError(404, "Suggested candidate not found."));

    renderView();

    expect(await screen.findByText("Could not load this profile")).toBeInTheDocument();
    expect(screen.getByText(/withdrawn their consent/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Experience" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it("shows the server message and a retry on another error", async () => {
    profileMock.mockRejectedValueOnce(httpError(409, "Candidates can only be suggested for a published offer."));
    profileMock.mockResolvedValue(detail());

    renderView();

    expect(
      await screen.findByText("Candidates can only be suggested for a published offer."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Experience" })).toBeInTheDocument();
  });

  it("shows the refusal of an invitation (409)", async () => {
    profileMock.mockResolvedValue(detail());
    inviteMock.mockRejectedValue(httpError(409, "This candidate has already been invited."));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Invite$/ }));

    expect(await screen.findByText("This candidate has already been invited.")).toBeInTheDocument();
  });

  it("shows a loading state first", () => {
    profileMock.mockReturnValue(new Promise(() => {}));

    renderView();

    expect(screen.getByText("Loading profile…")).toBeInTheDocument();
  });

  it("falls back to a neutral name when the account has none", async () => {
    profileMock.mockResolvedValue(detail({ card: card({ firstName: null, lastName: null }) }));

    renderView();

    await screen.findByRole("heading", { name: "Experience" });
    expect(screen.getAllByText("Candidate").length).toBeGreaterThan(0);
  });
});
