import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationsSection } from "@/features/invitation/invitations-section";
import { listMyInvitations } from "@/lib/api/invitation.api";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import type { CandidateInvitation } from "@/types/invitation";

vi.mock("@/lib/api/invitation.api", () => ({
  listMyInvitations: vi.fn(),
}));

const listMock = vi.mocked(listMyInvitations);

function invitation(overrides: Partial<CandidateInvitation> = {}): CandidateInvitation {
  return {
    id: "i1",
    invitedAt: "2026-10-20T10:00:00",
    job: {
      publicId: "abcdefghijkl",
      slug: "backend-engineer",
      title: "Backend Engineer",
      companyName: "Acme Labs",
    },
    ...overrides,
  };
}

describe("InvitationsSection", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("renders nothing while loading and when there is no invitation", async () => {
    listMock.mockResolvedValue([]);

    const { container } = renderWithQueryClient(<InvitationsSection />);

    expect(container).toBeEmptyDOMElement();
    await vi.waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Invitations" })).not.toBeInTheDocument();
  });

  it("lists each invitation with the offer, its company and the invitation date", async () => {
    listMock.mockResolvedValue([
      invitation(),
      invitation({
        id: "i2",
        job: { publicId: "mnopqrstuvwx", slug: "data-engineer", title: "Data Engineer", companyName: null },
      }),
    ]);

    renderWithQueryClient(<InvitationsSection />);

    expect(await screen.findByRole("heading", { name: "Invitations" })).toBeInTheDocument();
    expect(screen.getByText("2 invitations")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByRole("link", { name: "Backend Engineer" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer",
    );
    expect(within(first).getByText("Acme Labs")).toBeInTheDocument();
    expect(within(first).getByText("Invited Oct 20, 2026")).toBeInTheDocument();
    expect(within(second).getByRole("link", { name: "Data Engineer" })).toBeInTheDocument();
    expect(within(second).queryByText("Acme Labs")).not.toBeInTheDocument();
  });

  it("lays the invitations out on two columns from the xl breakpoint", async () => {
    listMock.mockResolvedValue([invitation(), invitation({ id: "i2" })]);

    renderWithQueryClient(<InvitationsSection />);

    await screen.findByRole("heading", { name: "Invitations" });
    const [first] = screen.getAllByRole("listitem");
    expect(first.parentElement).toHaveClass("grid", "grid-cols-1", "xl:grid-cols-2");
  });

  it("sends the candidate to the offer or straight to the application flow", async () => {
    listMock.mockResolvedValue([invitation()]);

    renderWithQueryClient(<InvitationsSection />);

    expect(await screen.findByText("1 invitation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer",
    );
    expect(screen.getByRole("link", { name: /Apply/ })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
  });

  it("exposes nothing about the recruiter or the screening", async () => {
    listMock.mockResolvedValue([invitation()]);

    renderWithQueryClient(<InvitationsSection />);

    await screen.findByText("1 invitation");
    expect(screen.queryByText(/rank/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score|match/i)).not.toBeInTheDocument();
  });

  it("tells the candidate when the invitations could not be loaded", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    // Sans les nouvelles tentatives par défaut : seul l'état d'erreur compte ici.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <InvitationsSection />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Could not load your invitations")).toBeInTheDocument();
  });
});
