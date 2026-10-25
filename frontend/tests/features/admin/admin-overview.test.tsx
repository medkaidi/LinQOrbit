import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/features/admin/admin-overview";
import { getAdminDashboard } from "@/lib/api/admin.api";
import { buildAdminDashboard } from "@/tests/helpers/admin-dashboard-fixtures";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/lib/api/admin.api", () => ({
  getAdminDashboard: vi.fn(),
}));

const dashboardMock = vi.mocked(getAdminDashboard);

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminOverview />
    </QueryClientProvider>,
  );
}

function card(section: string) {
  const metrics = screen.getByRole("region", { name: "Key metrics" });
  const label = within(metrics).getByText(section);
  return within(label.closest("div.rounded-2xl") as HTMLElement);
}

const populated = buildAdminDashboard({
  accounts: {
    active: 12,
    inactive: 3,
    suspended: 1,
    candidates: 9,
    recruiters: 5,
    admins: 2,
    newLast7Days: 4,
  },
  offers: { draft: 2, validated: 1, published: 6, closed: 3 },
  liveOffers: 5,
  applications: { toReview: 7, accepted: 3, rejected: 1, newLast7Days: 6 },
  moderation: { skillSuggestions: 4, reportsAwaitingMyReview: 2, reportsTotal: 9 },
  processingFailures: { candidateAnalyses: 1, offerAnalyses: 0, embeddings: 2, screenings: 0, matchings: 3 },
});

describe("AdminOverview", () => {
  beforeEach(() => {
    dashboardMock.mockReset();
    dashboardMock.mockResolvedValue(populated);
    useAuthStore.getState().clearAuth();
  });

  it("introduces the page like the other admin views", async () => {
    renderOverview();

    expect(screen.getByRole("heading", { level: 1, name: "Administration" })).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    await waitFor(() => expect(dashboardMock).toHaveBeenCalledTimes(1));
  });

  describe("key metrics", () => {
    it("shows the four real indicators, each with its band", async () => {
      renderOverview();

      await waitFor(() => expect(card("Accounts").getByText("12")).toBeInTheDocument());
      expect(card("Accounts").getByText("+4 this week")).toBeInTheDocument();
      expect(card("Accounts").getByText("9 candidates · 5 recruiters")).toBeInTheDocument();

      expect(card("Offers").getByText("5")).toBeInTheDocument();
      expect(card("Offers").getByText("12 in total · 2 drafts")).toBeInTheDocument();

      expect(card("Applications").getByText("7")).toBeInTheDocument();
      // Activité de la plateforme : l'admin ne décide pas des candidatures, les recruteurs si.
      expect(card("Applications").getByText("pending with recruiters")).toBeInTheDocument();
      expect(card("Applications").getByText("Recruiter decisions")).toBeInTheDocument();
      expect(card("Applications").queryByText("to review")).not.toBeInTheDocument();
      expect(card("Applications").getByText("+6 this week")).toBeInTheDocument();
      expect(card("Applications").getByText("3 accepted · 1 rejected")).toBeInTheDocument();

      // Suggestions + signalements que cet admin peut relire ; le total des signalements n'y entre pas.
      expect(card("Moderation").getByText("6")).toBeInTheDocument();
      expect(card("Moderation").getByText("4 suggestions · 2 AI reports")).toBeInTheDocument();
    });

    it("shows real zeros, not placeholders, on an empty platform", async () => {
      dashboardMock.mockResolvedValue(buildAdminDashboard());

      renderOverview();

      expect(await card("Moderation").findByText("0 suggestions · 0 AI reports")).toBeInTheDocument();
      for (const section of ["Accounts", "Offers", "Applications", "Moderation"]) {
        expect(card(section).getByText("0")).toBeInTheDocument();
      }
      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });

    it("shows a loading placeholder, never an invented figure, while the figures load", () => {
      dashboardMock.mockReturnValue(new Promise(() => undefined));

      renderOverview();

      for (const section of ["Accounts", "Offers", "Applications", "Moderation"]) {
        expect(card(section).getByText("—")).toBeInTheDocument();
      }
      expect(card("Accounts").getAllByText("Loading…").length).toBeGreaterThan(0);
    });
  });

  describe("needs your attention", () => {
    it("links each non-empty queue to where it is handled", async () => {
      renderOverview();

      const region = await screen.findByRole("region", { name: "Needs your attention" });
      expect(await within(region).findByRole("link", { name: /Review 4 skill suggestions/ })).toHaveAttribute(
        "href",
        "/admin/accounts",
      );
      expect(within(region).getByRole("link", { name: /Review 2 AI reports/ })).toHaveAttribute(
        "href",
        "/admin/reports",
      );
    });

    it("says there is nothing to review when the queues are empty, even if reports exist", async () => {
      dashboardMock.mockResolvedValue(
        buildAdminDashboard({ moderation: { skillSuggestions: 0, reportsAwaitingMyReview: 0, reportsTotal: 9 } }),
      );

      renderOverview();

      const region = await screen.findByRole("region", { name: "Needs your attention" });
      expect(await within(region).findByText(/Nothing to review/)).toBeInTheDocument();
      expect(within(region).queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("breakdowns", () => {
    it("lists the offers by status with their total", async () => {
      renderOverview();

      const region = await screen.findByRole("region", { name: "Offers by status" });
      await waitFor(() => expect(within(region).getByText("12 offers")).toBeInTheDocument());
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual([
        "2",
        "1",
        "6",
        "3",
      ]);
    });

    it("lists the accounts by status, suspended included, with their total", async () => {
      renderOverview();

      const region = await screen.findByRole("region", { name: "Accounts by status" });
      await waitFor(() => expect(within(region).getByText("16 accounts")).toBeInTheDocument());
      expect(within(region).getByText("Active")).toBeInTheDocument();
      expect(within(region).getByText("Inactive")).toBeInTheDocument();
      expect(within(region).getByText("Suspended")).toBeInTheDocument();
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["12", "3", "1"]);
    });
  });

  describe("layout", () => {
    it("puts the breakdowns on the left and the attention queue on the right", async () => {
      renderOverview();

      const offers = await screen.findByRole("region", { name: "Offers by status" });
      const accounts = screen.getByRole("region", { name: "Accounts by status" });
      const failures = screen.getByRole("region", { name: "AI processing failures" });
      const attention = screen.getByRole("region", { name: "Needs your attention" });
      for (const left of [offers, accounts, failures]) {
        expect(left.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      // Colonne d'actions en tête sous lg, en deuxième à partir de lg : l'ordre DOM ne la relègue pas.
      expect(attention.parentElement).toHaveClass("order-first", "lg:order-none", "lg:col-span-5");
    });

    it("draws bars for the offers and accounts by status, but not for the failures", async () => {
      renderOverview();

      const offers = await screen.findByRole("region", { name: "Offers by status" });
      await waitFor(() => expect(within(offers).getByText("12 offers")).toBeInTheDocument());
      expect(within(offers).getAllByTestId("breakdown-bar")).toHaveLength(4);
      expect(within(screen.getByRole("region", { name: "Accounts by status" })).getAllByTestId("breakdown-bar")).toHaveLength(3);
      expect(within(screen.getByRole("region", { name: "AI processing failures" })).queryByTestId("breakdown-bar")).not.toBeInTheDocument();
    });
  });

  describe("AI processing failures", () => {
    it("lists each processing queue with its failed count and the total, read-only", async () => {
      renderOverview();

      const region = await screen.findByRole("region", { name: "AI processing failures" });
      await waitFor(() => expect(within(region).getByText("6 failed")).toBeInTheDocument());
      expect(within(region).getAllByRole("term").map((cell) => cell.textContent)).toEqual([
        "Candidate profile analysis",
        "Job offer analysis",
        "Profile embeddings",
        "Candidate screening",
        "Match analysis",
      ]);
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual([
        "1",
        "0",
        "2",
        "0",
        "3",
      ]);
      // Lecture seule : ni lien ni bouton dans la carte.
      expect(within(region).queryByRole("link")).not.toBeInTheDocument();
      expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    });

    it("says that nothing failed, with real zeros, when every queue is healthy", async () => {
      dashboardMock.mockResolvedValue(buildAdminDashboard());
      renderOverview();

      const region = await screen.findByRole("region", { name: "AI processing failures" });
      await waitFor(() => expect(within(region).getByText("None failed")).toBeInTheDocument());
      expect(within(region).getAllByRole("definition").map((cell) => cell.textContent)).toEqual([
        "0",
        "0",
        "0",
        "0",
        "0",
      ]);
    });

    it("shows placeholders, never invented zeros, while loading", () => {
      dashboardMock.mockReturnValue(new Promise(() => {}));
      renderOverview();

      const region = screen.getByRole("region", { name: "AI processing failures" });
      expect(within(region).getAllByText("—")).toHaveLength(5);
      expect(within(region).queryByText("None failed")).not.toBeInTheDocument();
    });
  });

  describe("when the figures cannot be loaded", () => {
    beforeEach(() => {
      dashboardMock.mockRejectedValue(new Error("boom"));
    });

    it("shows the error with a retry and unavailable cards instead of invented numbers", async () => {
      renderOverview();

      expect(await screen.findByText("Could not load the platform figures")).toBeInTheDocument();
      for (const section of ["Accounts", "Offers", "Applications", "Moderation"]) {
        expect(card(section).getByText("—")).toBeInTheDocument();
      }
      expect(card("Accounts").getAllByText("Unavailable").length).toBeGreaterThan(0);
      const attention = screen.getByRole("region", { name: "Needs your attention" });
      expect(within(attention).getByText("The moderation queues could not be loaded.")).toBeInTheDocument();
      const accounts = screen.getByRole("region", { name: "Accounts by status" });
      expect(within(accounts).getAllByText("—")).toHaveLength(3);
      const processing = screen.getByRole("region", { name: "AI processing failures" });
      expect(within(processing).getAllByText("—")).toHaveLength(5);
    });

    it("reloads the figures when Retry is pressed", async () => {
      renderOverview();
      await screen.findByText("Could not load the platform figures");
      dashboardMock.mockResolvedValue(populated);

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => expect(card("Accounts").getByText("12")).toBeInTheDocument());
      expect(screen.queryByText("Could not load the platform figures")).not.toBeInTheDocument();
    });
  });
});
