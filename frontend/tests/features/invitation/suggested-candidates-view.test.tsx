import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import { SuggestedCandidatesView } from "@/features/invitation/suggested-candidates-view";
import { inviteSuggestedCandidate, listSuggestedCandidates } from "@/lib/api/invitation.api";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import type { SuggestedCandidate, SuggestedCandidates } from "@/types/invitation";

vi.mock("@/lib/api/invitation.api", () => ({
  listSuggestedCandidates: vi.fn(),
  inviteSuggestedCandidate: vi.fn(),
}));

const useJobOfferMock = vi.hoisted(() => vi.fn());
const useCompaniesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({ useJobOffer: useJobOfferMock }));
vi.mock("@/hooks/use-companies", () => ({ useCompanies: useCompaniesMock }));

const listMock = vi.mocked(listSuggestedCandidates);
const inviteMock = vi.mocked(inviteSuggestedCandidate);

function card(overrides: Partial<SuggestedCandidate> = {}): SuggestedCandidate {
  return {
    id: "s1",
    rank: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Backend Engineer",
    seniority: "senior",
    yearsOfExperience: 8,
    country: "FR",
    skills: [
      { name: "Java", level: 5 },
      { name: "PostgreSQL", level: null },
    ],
    status: "suggested",
    ...overrides,
  };
}

function page(items: SuggestedCandidate[], canInvite = true): SuggestedCandidates {
  return { canInvite, items };
}

function httpError(status: number, detail: string) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { detail },
  } as AxiosResponse);
}

function renderView() {
  return renderWithQueryClient(<SuggestedCandidatesView offerId="o1" />);
}

/** Cartes de candidats : les seuls items de liste qui portent un lien vers un profil. */
function cards() {
  return screen
    .getAllByRole("listitem")
    .filter((item) => item.querySelector("a[href*=\"/suggestions/\"]"));
}

describe("SuggestedCandidatesView", () => {
  beforeEach(() => {
    listMock.mockReset();
    inviteMock.mockReset();
    useJobOfferMock.mockReturnValue({
      data: { id: "o1", companyId: "c1", title: "Backend Engineer" },
    });
    useCompaniesMock.mockReturnValue({ data: [{ id: "c1", name: "Acme Labs" }] });
  });

  it("renders cards in screening order with name, position, chips, skills and rank", async () => {
    listMock.mockResolvedValue(
      page([
        card(),
        card({
          id: "s2",
          rank: 2,
          firstName: "Grace",
          lastName: "Hopper",
          title: "Data Engineer",
          seniority: "mid",
          yearsOfExperience: 1,
          country: null,
        }),
      ]),
    );

    renderView();

    expect(await screen.findByText("2 candidates")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer · Acme Labs")).toBeInTheDocument();
    const [first, second] = cards();
    expect(within(first).getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions/s1",
    );
    expect(within(first).getByText("AL")).toBeInTheDocument();
    expect(within(first).getByText("Backend Engineer")).toBeInTheDocument();
    expect(within(first).getByText("Senior")).toBeInTheDocument();
    expect(within(first).getByText("8 years")).toBeInTheDocument();
    expect(within(first).getByText("France")).toBeInTheDocument();
    expect(within(first).getByText("Java")).toBeInTheDocument();
    expect(within(first).getByText("PostgreSQL")).toBeInTheDocument();
    expect(within(first).getByText("Rank 1")).toBeInTheDocument();
    expect(within(second).getByRole("link", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(within(second).getByText("Data Engineer")).toBeInTheDocument();
    expect(within(second).getByText("1 year")).toBeInTheDocument();
    expect(within(second).queryByText("France")).not.toBeInTheDocument();
    // Pays absent : la cellule reste, estompée, pour garder les trois colonnes alignées.
    expect(within(second).getAllByText("Not provided")).toHaveLength(1);
    expect(listMock).toHaveBeenCalledWith("o1");
  });

  it("tolerates a card with no position, no chips and no skills", async () => {
    listMock.mockResolvedValue(
      page([card({ title: null, seniority: null, yearsOfExperience: null, country: null, skills: [] })]),
    );

    renderView();

    expect(await screen.findByRole("link", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("No skills listed")).toBeInTheDocument();
    // Les trois cellules de la bande de signaux restent rendues, valeurs absentes comprises.
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(3);
  });

  it("shows every skill as the same grey pill as the job board, with its level in a tooltip when known", async () => {
    listMock.mockResolvedValue(
      page([
        card({
          skills: [
            { name: "Java", level: 5 },
            { name: "Docker", level: 3 },
            { name: "PostgreSQL", level: null },
          ],
        }),
      ]),
    );

    renderView();

    await screen.findByRole("link", { name: "Ada Lovelace" });
    for (const name of ["Java", "Docker", "PostgreSQL"]) {
      expect(screen.getByText(name)).toHaveClass(...MUTED_PILL_CLASS.split(" "));
    }
    expect(screen.getByText("Java")).toHaveAttribute("title", "Level 5 of 5");
    expect(screen.getByText("PostgreSQL")).not.toHaveAttribute("title");
  });

  it("lays the cards out on two columns from the xl breakpoint, with a View profile link on each", async () => {
    listMock.mockResolvedValue(page([card(), card({ id: "s2", rank: 2, firstName: "Grace", lastName: "Hopper" })]));

    renderView();

    await screen.findByText("2 candidates");
    const [first, second] = cards();
    expect(first.parentElement).toHaveClass("grid", "grid-cols-1", "xl:grid-cols-2");
    expect(within(first).getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions/s1",
    );
    expect(within(second).getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions/s2",
    );
  });

  it("falls back to a neutral name when the account has none, and never says profiles are anonymous", async () => {
    listMock.mockResolvedValue(page([card({ firstName: null, lastName: null })]));

    renderView();

    expect(await screen.findByRole("link", { name: "Candidate" })).toBeInTheDocument();
    expect(screen.queryByText(/anonymous/i)).not.toBeInTheDocument();
    expect(screen.getByText(/agreed to share their profile with recruiters/)).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    listMock.mockResolvedValue(page([]));

    renderView();

    expect(await screen.findByText("No suggested candidates for this offer.")).toBeInTheDocument();
    expect(screen.getByText("0 candidates")).toBeInTheDocument();
  });

  it("surfaces a load error with a retry that reads the list again", async () => {
    listMock.mockRejectedValueOnce(httpError(409, "The offer is not published."));
    listMock.mockResolvedValue(page([card()]));

    renderView();

    expect(await screen.findByText("The offer is not published.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Ada Lovelace" })).toBeInTheDocument();
  });

  it("offers Invite to apply only on a suggested card, and an Invited / Applied state otherwise", async () => {
    listMock.mockResolvedValue(
      page([
        card({ id: "s1", rank: 1 }),
        card({ id: "s2", rank: 2, status: "invited" }),
        card({ id: "s3", rank: 3, status: "applied" }),
      ]),
    );

    renderView();

    await screen.findByText("3 candidates");
    expect(screen.getAllByRole("button", { name: /Invite to apply/ })).toHaveLength(1);
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("hides every invitation action when the server says the member cannot invite", async () => {
    listMock.mockResolvedValue(page([card()], false));

    renderView();

    await screen.findByRole("link", { name: "Ada Lovelace" });
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it("asks for confirmation, then invites by the card id and re-reads the list", async () => {
    listMock.mockResolvedValueOnce(page([card()]));
    listMock.mockResolvedValue(page([card({ status: "invited" })]));
    inviteMock.mockResolvedValue(card({ status: "invited" }));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    expect(inviteMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Invite this candidate to apply?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Invite$/ }));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledWith("o1", "s1"));
    expect(await screen.findByText("Invited")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invite to apply/ })).not.toBeInTheDocument();
  });

  it("does not invite when the confirmation is cancelled", async () => {
    listMock.mockResolvedValue(page([card()]));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(inviteMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the refusal of an invitation and re-reads the real state (409: already invited)", async () => {
    listMock.mockResolvedValueOnce(page([card()]));
    listMock.mockResolvedValue(page([card({ status: "invited" })]));
    inviteMock.mockRejectedValue(httpError(409, "This candidate has already been invited."));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Invite to apply/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Invite$/ }));

    expect(await screen.findByText("This candidate has already been invited.")).toBeInTheDocument();
    expect(await screen.findByText("Invited")).toBeInTheDocument();
  });
});
