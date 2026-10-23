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
      modelName: "gemini-3.1-flash-lite",
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

    // En-tête : le critère signalé porte le dossier, sans méta dupliquée.
    expect(await screen.findByRole("heading", { level: 1, name: "Java" })).toBeInTheDocument();
    expect(screen.getAllByText("The score is wrong")).toHaveLength(1);
    expect(screen.getAllByText("Reported on Oct 20, 2026")).toHaveLength(1);

    // Carte unique : contexte, motif, date, commentaire, score/rationale AI et liens.
    const reportCard = screen
      .getByRole("heading", { level: 2, name: "Report" })
      .closest("section") as HTMLElement;
    expect(within(reportCard).getByText("The score is wrong")).toBeInTheDocument();
    expect(
      within(reportCard).getByText("Reported on Oct 20, 2026"),
    ).toBeInTheDocument();
    expect(within(reportCard).getByText("Ada Owner")).toBeInTheDocument();
    expect(within(reportCard).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(reportCard).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(reportCard).getByText("Backend Engineer")).toBeInTheDocument();
    expect(within(reportCard).getByText("Acme")).toBeInTheDocument();
    expect(within(reportCard).getByText("The CV shows eight years of Java.")).toBeInTheDocument();

    // Le motif et la date vivent dans le même conteneur que le commentaire.
    const commentTile = within(reportCard)
      .getByText("The CV shows eight years of Java.")
      .closest("div") as HTMLElement;
    expect(within(commentTile).getByText("The score is wrong")).toBeInTheDocument();
    expect(
      within(commentTile).getByText("Reported on Oct 20, 2026"),
    ).toBeInTheDocument();
    expect(within(commentTile).getByText("Comment:")).toBeInTheDocument();

    expect(within(reportCard).getByRole("meter", { name: "Criterion score" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    expect(within(reportCard).getByRole("meter", { name: "Section score" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    expect(within(reportCard).getByText("Criterion")).toBeInTheDocument();
    expect(within(reportCard).getByText("Section")).toBeInTheDocument();
    expect(within(reportCard).getAllByText("60")).toHaveLength(2);
    expect(within(reportCard).getByText("Strong Java")).toBeInTheDocument();
    expect(within(reportCard).getByText("The CV shows three years of Java.")).toBeInTheDocument();
    expect(within(reportCard).getByText("AI rationale")).toBeInTheDocument();
    expect(within(reportCard).getByText("Required skills")).toBeInTheDocument();
    expect(within(reportCard).getByText("Model: gemini-3.1-flash-lite")).toBeInTheDocument();
    expect(
      within(reportCard).queryByRole("link", { name: "Verify on candidate profile" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Strong Java")).toHaveLength(2);
    expect(screen.getAllByText("The CV shows three years of Java.")).toHaveLength(2);
    expect(screen.getAllByText("Required skills")).toHaveLength(2);

    // Aucun faux extrait de CV, aucune confiance, pondération ou note recruteur.
    expect(screen.queryByText(/CV extract/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recruiter score/i)).not.toBeInTheDocument();

    // Contestation : note du candidat, écart et argumentaire.
    const contestCard = screen
      .getByRole("heading", { level: 2, name: "Candidate contestation" })
      .closest("section") as HTMLElement;
    expect(screen.getByText("I have eight years of Java.")).toBeInTheDocument();
    expect(screen.getAllByText("20 pts")).toHaveLength(2);
    expect(within(contestCard).getByText("Reported criterion")).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument();

    // Liens de contexte vers la console.
    expect(within(reportCard).getByRole("link", { name: "View offer" })).toHaveAttribute(
      "href",
      "/admin/offers/offer-1",
    );
    expect(within(reportCard).getByRole("link", { name: "View candidate" })).toHaveAttribute(
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
          modelName: null,
          resolved: false,
        },
        assessment: { available: false, sections: [] },
      }),
    );

    renderView();

    const reportCard = (
      await screen.findByRole("heading", { level: 2, name: "Report" })
    ).closest("section") as HTMLElement;
    expect(within(reportCard).getByText("Unresolved")).toBeInTheDocument();
    expect(within(reportCard).getByText("Criterion key")).toBeInTheDocument();
    expect(within(reportCard).getByText("skill:rust")).toBeInTheDocument();
    expect(within(reportCard).getByText("Model not recorded")).toBeInTheDocument();
    expect(
      within(reportCard).getByRole("link", { name: "View candidate" }),
    ).toHaveAttribute("href", "/admin/users/44444444-4444-4444-8444-444444444444");
    expect(within(reportCard).queryByRole("meter")).not.toBeInTheDocument();
    expect(within(reportCard).queryByText("AI score")).not.toBeInTheDocument();
    expect(within(reportCard).queryByText("Criterion")).not.toBeInTheDocument();
    expect(within(reportCard).queryByText("Section")).not.toBeInTheDocument();
    expect(within(reportCard).queryByText("AI rationale")).not.toBeInTheDocument();
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

  it("states when the model was not recorded for a resolved criterion", async () => {
    const detail = makeDetail();
    mockedGetCriterionReport.mockResolvedValue({
      ...detail,
      criterion: { ...detail.criterion, modelName: null },
    });

    renderView();

    const reportCard = (
      await screen.findByRole("heading", { level: 2, name: "Report" })
    ).closest("section") as HTMLElement;
    expect(within(reportCard).getByText("Model not recorded")).toBeInTheDocument();
    expect(within(reportCard).queryByText(/^Model: /)).not.toBeInTheDocument();
    expect(within(reportCard).getByRole("meter", { name: "Criterion score" })).toBeInTheDocument();
  });

  it("states when the candidate profile is unavailable", async () => {
    mockedGetCriterionReport.mockResolvedValue(makeDetail({ candidateUserId: null }));

    renderView();

    const reportCard = (
      await screen.findByRole("heading", { level: 2, name: "Report" })
    ).closest("section") as HTMLElement;
    expect(within(reportCard).getByText("Candidate profile unavailable")).toBeInTheDocument();
    expect(
      within(reportCard).queryByRole("link", { name: "View candidate" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Verify on candidate profile" })).not.toBeInTheDocument();
  });

  it("falls back honestly when optional report and criterion fields are empty", async () => {
    const base = makeDetail();
    mockedGetCriterionReport.mockResolvedValue({
      ...base,
      report: {
        ...base.report,
        comment: "",
        authorFirstName: null,
        authorLastName: null,
        authorEmail: "",
        candidateFirstName: null,
        candidateLastName: null,
        offerId: null,
        offerTitle: "",
        companyName: "",
        section: "",
      },
      criterion: {
        ...base.criterion,
        section: "",
        sectionScore: null,
        requirement: "",
        rationale: "",
        modelName: "",
      },
    });

    renderView();

    const reportCard = (
      await screen.findByRole("heading", { level: 2, name: "Report" })
    ).closest("section") as HTMLElement;
    expect(within(reportCard).getByText("Unknown author")).toBeInTheDocument();
    expect(within(reportCard).getByText("Unknown candidate")).toBeInTheDocument();
    expect(within(reportCard).getByText("Unknown offer")).toBeInTheDocument();
    expect(
      within(reportCard).getByText("No comment left by the recruiter."),
    ).toBeInTheDocument();
    expect(within(reportCard).getByText("Comment:")).toBeInTheDocument();
    expect(within(reportCard).queryByRole("link", { name: "View offer" })).not.toBeInTheDocument();
    expect(within(reportCard).getByRole("link", { name: "View candidate" })).toBeInTheDocument();
    expect(within(reportCard).getByText("Not specified")).toBeInTheDocument();
    expect(within(reportCard).getByText("No AI rationale.")).toBeInTheDocument();
    expect(within(reportCard).getByText("Not evaluated")).toBeInTheDocument();
    expect(within(reportCard).getByText("Model not recorded")).toBeInTheDocument();
    expect(within(reportCard).queryByText("Required skills")).not.toBeInTheDocument();
  });

  it("leaves candidate contestation and full AI assessment unchanged", async () => {
    mockedGetCriterionReport.mockResolvedValue(makeDetail());

    renderView();

    expect(await screen.findByRole("heading", { level: 1, name: "Java" })).toBeInTheDocument();

    const contestCard = screen
      .getByRole("heading", { level: 2, name: "Candidate contestation" })
      .closest("section") as HTMLElement;
    expect(within(contestCard).getByText("I have eight years of Java.")).toBeInTheDocument();
    expect(within(contestCard).getByText("Reported criterion")).toBeInTheDocument();
    expect(within(contestCard).getAllByText("20 pts")).toHaveLength(2);
    expect(within(contestCard).getByText("Java", { selector: "p" })).toBeInTheDocument();

    const assessmentCard = screen
      .getByRole("heading", { level: 2, name: "Full AI assessment" })
      .closest("section") as HTMLElement;
    expect(within(assessmentCard).getByText("Read-only")).toBeInTheDocument();
    expect(
      within(assessmentCard).getByRole("heading", { name: "Required skills" }),
    ).toBeInTheDocument();
    expect(within(assessmentCard).getByText("Kotlin is a plus.")).toBeInTheDocument();
    expect(within(assessmentCard).getByText("Reported")).toBeInTheDocument();
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
