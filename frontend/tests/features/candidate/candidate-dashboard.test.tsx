import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateDashboard } from "@/features/candidate/candidate-dashboard";
import { getCandidateDashboard } from "@/lib/api/application.api";
import { getProfile, getVisibilityConsent, listCvs } from "@/lib/api/candidate.api";
import { buildCvAttachment } from "@/tests/helpers/application-fixtures";
import {
  buildDashboard,
  buildDashboardApplication,
  buildDashboardProfile,
} from "@/tests/helpers/dashboard-fixtures";

vi.mock("@/lib/api/application.api", () => ({
  getCandidateDashboard: vi.fn(),
}));

vi.mock("@/lib/api/candidate.api", () => ({
  getProfile: vi.fn(),
  getVisibilityConsent: vi.fn(),
  listCvs: vi.fn(),
}));

const dashboardMock = vi.mocked(getCandidateDashboard);
const profileMock = vi.mocked(getProfile);
const consentMock = vi.mocked(getVisibilityConsent);
const cvsMock = vi.mocked(listCvs);

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CandidateDashboard />
    </QueryClientProvider>,
  );
}

function card(section: string) {
  const metrics = screen.getByRole("region", { name: "Key metrics" });
  const label = within(metrics).getByText(section);
  // Le conteneur de la carte : rubrique + chiffre + bandeau.
  return within(label.closest("div.rounded-2xl") as HTMLElement);
}

const populated = buildDashboard({
  applications: { draft: 1, submitted: 3, withdrawn: 1, accepted: 2, rejected: 4 },
  recentApplications: [
    buildDashboardApplication(),
    buildDashboardApplication({
      id: "a2",
      status: "draft",
      createdAt: "2026-10-22T09:00:00",
      job: { publicId: "mnopqrstuvwx", slug: "data-engineer", title: "Data Engineer", companyName: null },
    }),
  ],
  openInvitations: 2,
  openOffers: 37,
});

describe("CandidateDashboard", () => {
  beforeEach(() => {
    dashboardMock.mockReset();
    profileMock.mockReset();
    consentMock.mockReset();
    cvsMock.mockReset();
    dashboardMock.mockResolvedValue(populated);
    profileMock.mockResolvedValue(
      buildDashboardProfile({ completionPercentage: 82, hasUnvalidatedChanges: true }),
    );
    consentMock.mockResolvedValue({ consented: true, consentedAt: "2026-10-01T10:00:00" });
    cvsMock.mockResolvedValue([buildCvAttachment()]);
  });

  describe("key metrics", () => {
    it("shows the four real indicators, each with its band", async () => {
      renderDashboard();

      await waitFor(() => expect(card("Profile").getByText("82%")).toBeInTheDocument());
      expect(card("Profile").getByText("Changes to validate")).toBeInTheDocument();
      // 3 transmises + 2 acceptées + 4 refusées ; ni le brouillon ni le retrait.
      expect(card("Applications").getByText("9")).toBeInTheDocument();
      expect(card("Applications").getByText("1 draft to finish")).toBeInTheDocument();
      expect(card("Invitations").getByText("2")).toBeInTheDocument();
      expect(card("Invitations").getByText("Open from recruiters")).toBeInTheDocument();
      expect(card("Job board").getByText("37")).toBeInTheDocument();
      expect(card("Job board").getByText("open positions")).toBeInTheDocument();
    });

    it("shows real zeros for a candidate with no activity", async () => {
      dashboardMock.mockResolvedValue(buildDashboard());
      profileMock.mockResolvedValue(buildDashboardProfile({ completionPercentage: 0 }));

      renderDashboard();

      await waitFor(() => expect(card("Profile").getByText("0%")).toBeInTheDocument());
      expect(card("Profile").getByText("Nothing added yet")).toBeInTheDocument();
      expect(card("Applications").getByText("0")).toBeInTheDocument();
      expect(card("Applications").getByText("No draft in progress")).toBeInTheDocument();
      expect(card("Invitations").getByText("0")).toBeInTheDocument();
      expect(card("Invitations").getByText("None waiting")).toBeInTheDocument();
      expect(card("Job board").getByText("0")).toBeInTheDocument();
    });

    it("never invents a number while a source is loading", () => {
      dashboardMock.mockReturnValue(new Promise(() => {}));
      profileMock.mockReturnValue(new Promise(() => {}));

      renderDashboard();

      for (const section of ["Profile", "Applications", "Invitations", "Job board"]) {
        expect(card(section).getByText("—")).toBeInTheDocument();
      }
      expect(card("Applications").getByText("Loading…")).toBeInTheDocument();
    });

    it("shows no global matching score: the candidate only sees per-criterion scores", async () => {
      renderDashboard();
      await screen.findByText("82%");

      expect(screen.queryByText(/match/i)).not.toBeInTheDocument();
    });
  });

  describe("latest applications", () => {
    it("lists each application with its offer link, company, start date and status", async () => {
      renderDashboard();

      const list = await screen.findByRole("region", { name: "Latest applications" });
      const [first, second] = await within(list).findAllByRole("listitem");
      expect(within(first).getByRole("link", { name: "Backend Engineer" })).toHaveAttribute(
        "href",
        "/jobs/abcdefghijkl-backend-engineer",
      );
      expect(within(first).getByText("Acme Labs · Started Oct 20, 2026")).toBeInTheDocument();
      expect(within(first).getByText("Submitted")).toBeInTheDocument();
      expect(within(second).getByRole("link", { name: "Data Engineer" })).toBeInTheDocument();
      // Société absente : seule la date reste, sans séparateur orphelin.
      expect(within(second).getByText("Started Oct 22, 2026")).toBeInTheDocument();
      expect(within(second).getByText("Draft")).toBeInTheDocument();
      expect(within(list).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/applications");
    });

    it("invites to browse offers when there is no application yet", async () => {
      dashboardMock.mockResolvedValue(buildDashboard({ openOffers: 5 }));

      renderDashboard();

      const section = await screen.findByRole("region", { name: "Latest applications" });
      expect(await within(section).findByText("You have not applied to any job offer yet.")).toBeInTheDocument();
      expect(within(section).getByRole("link", { name: "Browse offers" })).toHaveAttribute("href", "/jobs");
      expect(within(section).queryByRole("link", { name: "View all" })).not.toBeInTheDocument();
    });
  });

  describe("application pipeline", () => {
    it("counts every status and the total", async () => {
      renderDashboard();

      const pipeline = await screen.findByRole("region", { name: "Application pipeline" });
      await within(pipeline).findByText("11 applications");
      const rows = within(pipeline).getAllByText(/^(Draft|Submitted|Accepted|Rejected|Withdrawn)$/);
      expect(rows.map((row) => row.textContent)).toEqual([
        "Draft",
        "Submitted",
        "Accepted",
        "Rejected",
        "Withdrawn",
      ]);
      const values = Array.from(pipeline.querySelectorAll("dd")).map((dd) => dd.textContent);
      expect(values).toEqual(["1", "3", "2", "4", "1"]);
    });

    it("keeps the five statuses at zero for a candidate with no application", async () => {
      dashboardMock.mockResolvedValue(buildDashboard());

      renderDashboard();

      const pipeline = await screen.findByRole("region", { name: "Application pipeline" });
      await within(pipeline).findByText("0 application");
      expect(Array.from(pipeline.querySelectorAll("dd")).map((dd) => dd.textContent)).toEqual([
        "0",
        "0",
        "0",
        "0",
        "0",
      ]);
    });
  });

  describe("layout", () => {
    it("keeps the figures on the left and the next steps, the action, on the right", async () => {
      renderDashboard();

      const steps = await screen.findByRole("region", { name: "Next steps" });
      const pipeline = await screen.findByRole("region", { name: "Application pipeline" });
      const latest = await screen.findByRole("region", { name: "Latest applications" });
      const figures = pipeline.parentElement as HTMLElement;
      expect(figures).toHaveClass("lg:col-span-7");
      expect(latest.parentElement).toBe(figures);
      expect(pipeline.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(steps.parentElement).toHaveClass("lg:col-span-5", "order-first");
    });

    it("draws a bar per pipeline status, in the colour of its pill", async () => {
      renderDashboard();

      const pipeline = await screen.findByRole("region", { name: "Application pipeline" });
      await within(pipeline).findByText("11 applications");
      const widths = within(pipeline).getAllByTestId("breakdown-bar").map((bar) => (bar as HTMLElement).style.width);
      expect(widths).toHaveLength(5);
      // 1, 3, 2, 4, 1 sur 11 : jamais une part inventée.
      expect(widths.map((width) => Math.round(parseFloat(width)))).toEqual([9, 27, 18, 36, 9]);
    });
  });

  describe("next steps", () => {
    it("links each step to where it is handled", async () => {
      renderDashboard();

      const steps = await screen.findByRole("region", { name: "Next steps" });
      await within(steps).findByText("Answer 2 invitations");
      expect(within(steps).getByRole("link", { name: /Answer 2 invitations/ })).toHaveAttribute(
        "href",
        "/applications",
      );
      expect(within(steps).getByRole("link", { name: /Finish 1 draft/ })).toHaveAttribute(
        "href",
        "/applications",
      );
      expect(within(steps).getByRole("link", { name: /Complete your profile/ })).toHaveAttribute(
        "href",
        "/profile/edit",
      );
      expect(within(steps).getByRole("link", { name: /Validate your profile/ })).toHaveAttribute(
        "href",
        "/profile",
      );
    });

    it("says everything is in order when nothing needs attention", async () => {
      dashboardMock.mockResolvedValue(
        buildDashboard({ applications: { draft: 0, submitted: 1, withdrawn: 0, accepted: 0, rejected: 0 } }),
      );
      profileMock.mockResolvedValue(buildDashboardProfile());

      renderDashboard();

      const steps = await screen.findByRole("region", { name: "Next steps" });
      expect(await within(steps).findByText(/You.re all set/)).toBeInTheDocument();
    });

    it("suggests the CV and the visibility setting when they are missing", async () => {
      dashboardMock.mockResolvedValue(
        buildDashboard({ applications: { draft: 0, submitted: 1, withdrawn: 0, accepted: 0, rejected: 0 } }),
      );
      profileMock.mockResolvedValue(buildDashboardProfile());
      consentMock.mockResolvedValue({ consented: false, consentedAt: null });
      cvsMock.mockResolvedValue([]);

      renderDashboard();

      const steps = await screen.findByRole("region", { name: "Next steps" });
      expect(await within(steps).findByRole("link", { name: /Upload your CV/ })).toBeInTheDocument();
      expect(within(steps).getByRole("link", { name: /Let recruiters find you/ })).toBeInTheDocument();
    });
  });

  describe("failures", () => {
    it("keeps the other sources when the activity fails, and retries on demand", async () => {
      // Profil complet et validé : aucune étape ne peut sortir des sources disponibles.
      profileMock.mockResolvedValue(buildDashboardProfile());
      dashboardMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(populated);

      renderDashboard();

      expect(await screen.findByText("Could not load your activity")).toBeInTheDocument();
      expect(card("Applications").getByText("—")).toBeInTheDocument();
      expect(card("Applications").getByText("Unavailable")).toBeInTheDocument();
      // Le profil, lui, s'affiche : une source en échec ne vide pas les autres.
      expect(await card("Profile").findByText("100%")).toBeInTheDocument();
      const steps = screen.getByRole("region", { name: "Next steps" });
      expect(
        await within(steps).findByText("Some of your information could not be loaded."),
      ).toBeInTheDocument();
      expect(within(steps).queryByText(/You.re all set/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(await card("Applications").findByText("9")).toBeInTheDocument();
      expect(screen.queryByText("Could not load your activity")).not.toBeInTheDocument();
      expect(dashboardMock).toHaveBeenCalledTimes(2);
    });

    it("flags a profile that cannot be loaded without blanking the activity", async () => {
      profileMock.mockRejectedValue(new Error("boom"));

      renderDashboard();

      expect(await screen.findByText("Could not load your profile status")).toBeInTheDocument();
      expect(card("Profile").getByText("—")).toBeInTheDocument();
      expect(card("Profile").getByText("Unavailable")).toBeInTheDocument();
      expect(await card("Invitations").findByText("2")).toBeInTheDocument();
    });
  });
});
