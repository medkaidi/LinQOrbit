import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getCriterionReport: vi.fn(),
  };
});

import { getCriterionReport } from "@/lib/api/admin.api";
import { AdminReportDetailView } from "@/features/admin/admin-report-detail-view";
import type { AdminCriterionReportDetail } from "@/types/admin";

const mockedGetCriterionReport = vi.mocked(getCriterionReport);

function makeDetail(
  overrides: Partial<AdminCriterionReportDetail> = {},
): AdminCriterionReportDetail {
  return {
    report: {
      id: "report-1",
      criterionKey: "skill:java",
      criterionLabel: "Java",
      section: "requiredSkills",
      score: 60,
      sectionScore: 60,
      reason: "scoreIncorrect",
      comment: "The CV shows eight years of Java.",
      createdAt: "2026-10-20T10:00:00",
      authorFirstName: "Ada",
      authorLastName: "Owner",
      authorEmail: "ada@example.com",
      candidateFirstName: "Grace",
      candidateLastName: "Hopper",
      offerId: "offer-1",
      offerTitle: "Backend Engineer",
      companyName: "Acme",
    },
    candidateUserId: "44444444-4444-4444-8444-444444444444",
    criterion: {
      key: "skill:java",
      label: "Java",
      section: "requiredSkills",
      score: 60,
      sectionScore: 60,
      requirement: "Strong Java",
      rationale: "The CV shows three years of Java.",
      resolved: true,
    },
    assessment: {
      available: true,
      sections: [
        {
          section: "requiredSkills",
          score: 60,
          criteria: [
            {
              key: "skill:java",
              label: "Java",
              requirement: "Strong Java",
              weight: 4,
              score: 60,
              rationale: "The CV shows three years of Java.",
            },
            {
              key: "skill:kotlin",
              label: "Kotlin",
              requirement: null,
              weight: 1,
              score: 70,
              rationale: "Kotlin is a plus.",
            },
          ],
        },
      ],
    },
    contests: [
      {
        criterionKey: "skill:java",
        label: "Java",
        aiScore: 60,
        selfValue: 80,
        gap: 20,
        comment: "I have eight years of Java.",
      },
    ],
    averageGap: 20,
    ...overrides,
  };
}

function renderView(reportId = "report-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminReportDetailView reportId={reportId} />
    </QueryClientProvider>,
  );
}

function notFoundError() {
  return Object.assign(new Error("Not found"), {
    isAxiosError: true,
    response: { status: 404 },
  });
}

describe("AdminReportDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the report, the scored criterion, the contest and the full assessment", async () => {
    mockedGetCriterionReport.mockResolvedValue(makeDetail());

    renderView();

    // En-tête : le critère signalé porte le dossier.
    expect(await screen.findByRole("heading", { level: 1, name: "Java" })).toBeInTheDocument();
    expect(screen.getAllByText("The score is wrong").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Oct 20, 2026").length).toBeGreaterThan(0);

    // Le signalement : auteur, candidat, offre et commentaire.
    expect(screen.getByText("Ada Owner")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("The CV shows eight years of Java.")).toBeInTheDocument();

    // Contexte de notation relu dans le résultat épinglé.
    expect(screen.getAllByText("Strong Java")).toHaveLength(2);
    expect(screen.getAllByText("The CV shows three years of Java.")).toHaveLength(2);
    expect(screen.getAllByText("Required skills")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Reported criterion" })).toBeInTheDocument();
    expect(screen.getByText("AI rationale")).toBeInTheDocument();

    // Contestation : note du candidat, écart et argumentaire.
    const contestCard = screen
      .getByRole("heading", { level: 2, name: "Candidate contestation" })
      .closest("section") as HTMLElement;
    expect(screen.getByText("I have eight years of Java.")).toBeInTheDocument();
    expect(screen.getAllByText("20 pts")).toHaveLength(2);
    expect(within(contestCard).getByText("Reported criterion")).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument();

    // Liens de contexte vers la console.
    expect(screen.getByRole("link", { name: "View offer" })).toHaveAttribute(
      "href",
      "/admin/offers/offer-1",
    );
    expect(screen.getByRole("link", { name: "View candidate" })).toHaveAttribute(
      "href",
      "/admin/users/44444444-4444-4444-8444-444444444444",
    );

    expect(mockedGetCriterionReport).toHaveBeenCalledWith("report-1", {
      signal: expect.any(AbortSignal),
    });
  });

  it("states that the candidate did not contest when there is no contestation", async () => {
    mockedGetCriterionReport.mockResolvedValue(
      makeDetail({ contests: [], averageGap: null }),
    );

    renderView();

    expect(
      await screen.findByText("The candidate did not contest any criterion of this assessment."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Average gap")).not.toBeInTheDocument();
    const contestCard = screen
      .getByRole("heading", { level: 2, name: "Candidate contestation" })
      .closest("section") as HTMLElement;
    expect(within(contestCard).queryByText("Reported criterion")).not.toBeInTheDocument();
  });

  it("keeps the report readable when the criterion is missing from the pinned assessment", async () => {
    mockedGetCriterionReport.mockResolvedValue(
      makeDetail({
        report: {
          ...makeDetail().report,
          criterionKey: "skill:rust",
          criterionLabel: "skill:rust",
          section: null,
        },
        criterion: {
          key: "skill:rust",
          label: "skill:rust",
          section: null,
          score: null,
          sectionScore: null,
          requirement: null,
          rationale: null,
          resolved: false,
        },
        assessment: { available: false, sections: [] },
      }),
    );

    renderView();

    expect(await screen.findByText("Unresolved")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This criterion no longer exists in the pinned AI assessment. The report is kept as-is — no score or rationale is shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("AI rationale")).not.toBeInTheDocument();
    expect(
      screen.getByText("No completed AI assessment is linked to this report."),
    ).toBeInTheDocument();
    // Le signalement reste visible : jamais un écran vide sur une donnée historique.
    expect(screen.getByText("The CV shows eight years of Java.")).toBeInTheDocument();
  });

  it("shows a not-found state with a way back to the list", async () => {
    mockedGetCriterionReport.mockRejectedValue(notFoundError());

    renderView();

    expect(await screen.findByText("Report not found")).toBeInTheDocument();
    expect(screen.getByText("No AI report matches this identifier.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to AI reports" })).toHaveAttribute(
      "href",
      "/admin/reports",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("surfaces a load error with a retry that re-queries", async () => {
    mockedGetCriterionReport.mockRejectedValueOnce(new Error("boom"));

    renderView();

    expect(await screen.findByText("Unable to load the report")).toBeInTheDocument();

    mockedGetCriterionReport.mockResolvedValue(makeDetail());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Java" })).toBeInTheDocument();
  });
});
