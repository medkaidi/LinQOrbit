import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecruiterDashboard } from "@/features/recruiter/recruiter-dashboard";
import { getRecruiterDashboard } from "@/lib/api/job-offer.api";
import { listCompanies } from "@/lib/api/company.api";
import { getRecruiter } from "@/lib/api/recruiter.api";
import { buildAttentionOffer, buildRecruiterDashboard } from "@/tests/helpers/recruiter-dashboard-fixtures";

vi.mock("@/lib/api/job-offer.api", () => ({
  getRecruiterDashboard: vi.fn(),
}));
vi.mock("@/lib/api/recruiter.api", () => ({
  getRecruiter: vi.fn(),
}));
vi.mock("@/lib/api/company.api", () => ({
  listCompanies: vi.fn(),
}));
vi.mock("@/lib/api/invitation.api", () => ({
  retryScreening: vi.fn(),
}));

const dashboardMock = vi.mocked(getRecruiterDashboard);
const profileMock = vi.mocked(getRecruiter);
const companiesMock = vi.mocked(listCompanies);

const NOT_FOUND = Object.assign(new Error("Not found"), { isAxiosError: true, response: { status: 404 } });

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecruiterDashboard />
    </QueryClientProvider>,
  );
}

function card(section: string) {
  const metrics = screen.getByRole("region", { name: "Key metrics" });
  const label = within(metrics).getByText(section);
  return within(label.closest("div.rounded-2xl") as HTMLElement);
}

const populated = buildRecruiterDashboard({
  offers: { draft: 2, validated: 1, published: 5, closed: 3 },
  liveOffers: 4,
  closingSoon: { count: 2, nextExpiry: "2026-11-03" },
  applications: { toReview: 7, accepted: 3, rejected: 1 },
  candidates: { toInvite: 6, invited: 2, searchesFailed: 1 },
  attention: [
    buildAttentionOffer({ id: "o1", title: "Staff Backend Engineer", toReview: 5 }),
    buildAttentionOffer({
      id: "o2",
      title: "Data Engineer",
      status: "published",
      expiresAt: "2020-01-01",
      screening: { status: "failed", candidateCount: null },
    }),
    buildAttentionOffer({ id: "o3", title: "Closed Role", status: "closed", toReview: 1 }),
  ],
});

describe("RecruiterDashboard", () => {
  beforeEach(() => {
    dashboardMock.mockReset();
    profileMock.mockReset();
    companiesMock.mockReset();
    dashboardMock.mockResolvedValue(populated);
    profileMock.mockResolvedValue({ id: "r1", headline: null, bio: null });
    companiesMock.mockResolvedValue([{ id: "c1", name: "Acme", description: null, isOwner: true }]);
  });

  describe("key metrics", () => {
    it("shows the four real indicators, each with its band", async () => {
      renderDashboard();

      await waitFor(() => expect(card("Offers").getByText("4")).toBeInTheDocument());
      expect(card("Offers").getByText("2 drafts · 1 validated")).toBeInTheDocument();
      expect(card("Applications").getByText("7")).toBeInTheDocument();
      expect(card("Applications").getByText("3 accepted · 1 rejected")).toBeInTheDocument();
      expect(card("Candidates").getByText("6")).toBeInTheDocument();
      expect(card("Candidates").getByText("to invite")).toBeInTheDocument();
      expect(card("Candidates").getByText("2 invited so far")).toBeInTheDocument();
      expect(card("Deadlines").getByText("2")).toBeInTheDocument();
      expect(card("Deadlines").getByText("Next on Nov 3, 2026")).toBeInTheDocument();
    });

    it("shows real zeros for an account with no activity", async () => {
      dashboardMock.mockResolvedValue(buildRecruiterDashboard());

      renderDashboard();

      await waitFor(() => expect(card("Offers").getByText("0 drafts · 0 validated")).toBeInTheDocument());
      expect(card("Applications").getByText("0")).toBeInTheDocument();
      expect(card("Candidates").getByText("No invitation sent yet")).toBeInTheDocument();
      expect(card("Deadlines").getByText("None in the next 30 days")).toBeInTheDocument();
      expect(screen.getByText("No offer needs your attention right now.")).toBeInTheDocument();
      expect(screen.getByText("Create your first offer")).toBeInTheDocument();
    });

    it("never invents a number while the figures are loading", async () => {
      dashboardMock.mockReturnValue(new Promise(() => {}));

      renderDashboard();

      await waitFor(() => expect(card("Offers").getByText("—")).toBeInTheDocument());
      for (const section of ["Offers", "Applications", "Candidates", "Deadlines"]) {
        expect(card(section).getByText("—")).toBeInTheDocument();
      }
      expect(card("Offers").getByText("Loading…")).toBeInTheDocument();
    });

    it("shows dashes, Unavailable and a working Retry when the figures fail", async () => {
      dashboardMock.mockRejectedValueOnce(new Error("boom"));

      renderDashboard();

      expect(await screen.findByText("Could not load your hiring activity")).toBeInTheDocument();
      expect(card("Applications").getByText("—")).toBeInTheDocument();
      expect(card("Applications").getByText("Unavailable")).toBeInTheDocument();
      expect(screen.getByText("Your hiring status could not be loaded.")).toBeInTheDocument();

      dashboardMock.mockResolvedValueOnce(populated);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => expect(card("Applications").getByText("7")).toBeInTheDocument());
      expect(screen.queryByText("Could not load your hiring activity")).not.toBeInTheDocument();
    });

    it("shows no average match, hire delay or trend: the database carries none", async () => {
      renderDashboard();
      await screen.findByText("2 drafts · 1 validated");

      expect(screen.queryByText(/average match/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/time-to-hire/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/vs last month/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/AI agent|recommendation|predictive/i)).not.toBeInTheDocument();
    });
  });

  describe("offers needing attention", () => {
    it("links an offer with pending applications to its applications, others to the preview", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Offers needing attention" });
      await within(region).findByText("Staff Backend Engineer");
      expect(within(region).getByRole("link", { name: "Staff Backend Engineer" })).toHaveAttribute(
        "href",
        "/recruiter/offers/o1/applications",
      );
      expect(within(region).getByRole("link", { name: "Data Engineer" })).toHaveAttribute(
        "href",
        "/recruiter/offers/o2/preview",
      );
      expect(within(region).getByText("5 applications to review")).toBeInTheDocument();
      expect(within(region).getByText("1 application to review")).toBeInTheDocument();
    });

    it("shows the status, an expired offer, and a retry on a failed candidate search", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Offers needing attention" });
      await within(region).findByText("Data Engineer");
      expect(within(region).getByText("Expired")).toBeInTheDocument();
      expect(within(region).getByText("Search failed")).toBeInTheDocument();
      expect(within(region).getByRole("button", { name: /retry search/i })).toBeInTheDocument();
      expect(within(region).getByText("Closed")).toBeInTheDocument();
    });

    it("links the whole offer list", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Offers needing attention" });
      expect(within(region).getByRole("link", { name: "View all offers" })).toHaveAttribute(
        "href",
        "/recruiter",
      );
    });
  });

  describe("offers by status and next steps", () => {
    it("keeps the figures on the left and the actions, next steps then offers to handle, on the right", async () => {
      renderDashboard();

      const offers = await screen.findByRole("region", { name: "Offers by status" });
      const decisions = await screen.findByRole("region", { name: "Applications by decision" });
      const steps = await screen.findByRole("region", { name: "Next steps" });
      const attention = await screen.findByRole("region", { name: "Offers needing attention" });
      expect(offers.parentElement).toHaveClass("lg:col-span-7");
      expect(decisions.parentElement).toBe(offers.parentElement);
      expect(offers.compareDocumentPosition(decisions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(steps.parentElement).toHaveClass("lg:col-span-5", "order-first");
      expect(attention.parentElement).toBe(steps.parentElement);
      expect(steps.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("counts the decisions on applications, with a bar per decision", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Applications by decision" });
      await within(region).findByText("11 applications");
      expect(within(region).getByText("To review")).toBeInTheDocument();
      expect(within(region).getByText("Accepted")).toBeInTheDocument();
      expect(within(region).getByText("Rejected")).toBeInTheDocument();
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["7", "3", "1"]);
      const widths = within(region).getAllByTestId("breakdown-bar").map((bar) => (bar as HTMLElement).style.width);
      // 7, 3, 1 sur 11.
      expect(widths.map((width) => Math.round(parseFloat(width)))).toEqual([64, 27, 9]);
    });

    it("keeps the three decisions at zero, with empty tracks, for a recruiter with no application", async () => {
      dashboardMock.mockResolvedValue(buildRecruiterDashboard());
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Applications by decision" });
      await within(region).findByText("0 application");
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["0", "0", "0"]);
      expect(within(region).getAllByTestId("breakdown-bar").map((bar) => (bar as HTMLElement).style.width)).toEqual([
        "0%",
        "0%",
        "0%",
      ]);
    });

    it("draws a bar per status of the lifecycle", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Offers by status" });
      await within(region).findByText("11 offers");
      const widths = within(region).getAllByTestId("breakdown-bar").map((bar) => (bar as HTMLElement).style.width);
      // 2, 1, 5, 3 sur 11.
      expect(widths.map((width) => Math.round(parseFloat(width)))).toEqual([18, 9, 45, 27]);
    });

    it("counts every status of the lifecycle and the total", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Offers by status" });
      await within(region).findByText("11 offers");
      const rows = within(region).getAllByText(/^(2|1|5|3)$/);
      expect(rows.map((row) => row.textContent)).toEqual(["2", "1", "5", "3"]);
    });

    it("lists the steps derived from the real state, each as a link", async () => {
      renderDashboard();

      const region = await screen.findByRole("region", { name: "Next steps" });
      const review = await within(region).findByRole("link", { name: /Review 7 applications/ });
      expect(review).toHaveAttribute("href", "/recruiter/offers/o1/applications");
      expect(within(region).getByRole("link", { name: /Retry 1 failed candidate search/ })).toBeInTheDocument();
      expect(within(region).getByRole("link", { name: /Invite 6 suggested candidates/ })).toBeInTheDocument();
      expect(within(region).getByRole("link", { name: /Publish 1 validated offer/ })).toBeInTheDocument();
      expect(within(region).getByRole("link", { name: /Finish 2 drafts/ })).toBeInTheDocument();
      expect(within(region).getByRole("link", { name: /2 offers closing soon/ })).toBeInTheDocument();
    });

    it("says everything is in order when nothing is pending", async () => {
      dashboardMock.mockResolvedValue(
        buildRecruiterDashboard({ offers: { draft: 0, validated: 0, published: 2, closed: 0 }, liveOffers: 2 }),
      );

      renderDashboard();

      expect(await screen.findByText(/nothing needs your attention right now/)).toBeInTheDocument();
    });
  });

  describe("account without recruiter profile or company", () => {
    it("renders nothing and never calls the dashboard when the account has no recruiter profile", async () => {
      profileMock.mockRejectedValue(NOT_FOUND);

      const { container } = renderDashboard();

      await waitFor(() => expect(profileMock).toHaveBeenCalled());
      await waitFor(() => expect(companiesMock).toHaveBeenCalled());
      expect(container).toBeEmptyDOMElement();
      expect(dashboardMock).not.toHaveBeenCalled();
    });

    it("renders nothing and never calls the dashboard when the recruiter has no company", async () => {
      companiesMock.mockResolvedValue([]);

      const { container } = renderDashboard();

      await waitFor(() => expect(companiesMock).toHaveBeenCalled());
      await waitFor(() => expect(profileMock).toHaveBeenCalled());
      expect(container).toBeEmptyDOMElement();
      expect(dashboardMock).not.toHaveBeenCalled();
    });

    it("mentions no onboarding, setup link or recruiter-space link when it has nothing to show", async () => {
      profileMock.mockRejectedValue(NOT_FOUND);
      companiesMock.mockResolvedValue([]);

      renderDashboard();

      await waitFor(() => expect(profileMock).toHaveBeenCalled());
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
      expect(screen.queryByText(/company|set up|get started|welcome/i)).not.toBeInTheDocument();
    });

    it("shows nothing while the profile is still loading, never zeros", () => {
      profileMock.mockReturnValue(new Promise(() => {}));
      companiesMock.mockReturnValue(new Promise(() => {}));

      const { container } = renderDashboard();

      expect(container).toBeEmptyDOMElement();
      expect(dashboardMock).not.toHaveBeenCalled();
    });

    it("reports a failed account read with a Retry instead of hiding it", async () => {
      profileMock.mockRejectedValueOnce(new Error("boom"));

      renderDashboard();

      expect(await screen.findByText("Could not load your recruiter account")).toBeInTheDocument();
      expect(dashboardMock).not.toHaveBeenCalled();

      profileMock.mockResolvedValueOnce({ id: "r1", headline: null, bio: null });
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => expect(dashboardMock).toHaveBeenCalledTimes(1));
    });
  });
});
