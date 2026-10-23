import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getCriterionReport: vi.fn(),
    createCriterionReportReview: vi.fn(),
  };
});

import { createCriterionReportReview, getCriterionReport } from "@/lib/api/admin.api";
import { AdminReportDetailView } from "@/features/admin/admin-report-detail-view";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";
import type {
  AdminCriterionReportDetail,
  AdminCriterionReportReview,
} from "@/types/admin";

const mockedGetCriterionReport = vi.mocked(getCriterionReport);
const mockedCreateCriterionReportReview = vi.mocked(createCriterionReportReview);

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@linqorbit.local",
  firstName: "Platform",
  lastName: "Admin",
  sex: null,
  phone: null,
  homeCountry: null,
  currentCity: null,
  currentCountry: null,
  roles: [1],
};

function makeReview(
  overrides: Partial<AdminCriterionReportReview> = {},
): AdminCriterionReportReview {
  return {
    id: "review-1",
    verdict: "upheld",
    note: "The report is valid.",
    correctedScore: 80,
    correctedRationale: "The CV shows eight years of Java.",
    createdAt: "2026-10-23T10:00:00",
    ...overrides,
  };
}

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
    myReview: null,
    ...overrides,
  };
}

function renderView(reportId = "report-1", user: AuthUser = adminUser) {
  useAuthStore.getState().setAuth({ token: "jwt-token", user });
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

async function reviewCard() {
  return (
    await screen.findByRole("heading", { level: 2, name: "Internal review" })
  ).closest("section") as HTMLElement;
}

describe("AdminReportDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateCriterionReportReview.mockReset();
    useAuthStore.getState().clearAuth();
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

  it("requires a verdict and only submits after a final confirmation", async () => {
    const createdReview = makeReview({
      note: "Needs a correction.",
      correctedScore: 85,
      correctedRationale: "The CV shows eight years.",
    });
    mockedGetCriterionReport
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValue(makeDetail({ myReview: createdReview }));
    mockedCreateCriterionReportReview.mockResolvedValue(createdReview);

    renderView();
    const card = await reviewCard();

    expect(within(card).getByRole("group", { name: "Verdict" })).toBeInTheDocument();
    expect(within(card).queryByText("Blind")).not.toBeInTheDocument();
    expect(within(card).queryByText("Final")).not.toBeInTheDocument();
    expect(
      within(card).queryByLabelText("Corrected score (optional)"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));
    expect(await within(card).findByText("Choose a verdict")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Upheld" }));
    expect(within(card).getByLabelText("Corrected score (optional)")).toBeInTheDocument();
    expect(
      within(card).getByLabelText("Corrected rationale (optional)"),
    ).toBeInTheDocument();

    fireEvent.change(within(card).getByLabelText("Corrected score (optional)"), {
      target: { value: "101" },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));
    expect(
      await within(card).findByText("Enter a whole number between 0 and 100"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(within(card).getByLabelText("Note (optional)"), {
      target: { value: "Needs a correction." },
    });
    fireEvent.change(within(card).getByLabelText("Corrected score (optional)"), {
      target: { value: "85" },
    });
    fireEvent.change(within(card).getByLabelText("Corrected rationale (optional)"), {
      target: { value: "The CV shows eight years." },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm your review" });
    expect(within(dialog).getByText("Upheld")).toBeInTheDocument();
    expect(within(dialog).getByText("Needs a correction.")).toBeInTheDocument();
    expect(within(dialog).getByText("85%")).toBeInTheDocument();
    expect(within(dialog).getByText("The CV shows eight years.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Final, cannot be edited/)).toBeInTheDocument();
    expect(mockedCreateCriterionReportReview).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedCreateCriterionReportReview).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));
    const reopened = await screen.findByRole("dialog", { name: "Confirm your review" });
    fireEvent.click(within(reopened).getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(mockedCreateCriterionReportReview).toHaveBeenCalledWith("report-1", {
        verdict: "upheld",
        note: "Needs a correction.",
        correctedScore: 85,
        correctedRationale: "The CV shows eight years.",
      }),
    );

    expect(
      await screen.findByText(
        "Your review is final and cannot be edited. It does not change the report, the AI score or the recruiter's decision.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(card).queryByRole("group", { name: "Verdict" })).not.toBeInTheDocument();
    expect(within(card).getByText("Needs a correction.")).toBeInTheDocument();
    expect(within(card).getByText("85%")).toBeInTheDocument();
  });

  it("sends no corrections when the report is not upheld", async () => {
    const createdReview = makeReview({
      verdict: "notUpheld",
      note: "The AI score is correct.",
      correctedScore: null,
      correctedRationale: null,
    });
    mockedGetCriterionReport
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValue(makeDetail({ myReview: createdReview }));
    mockedCreateCriterionReportReview.mockResolvedValue(createdReview);

    renderView();
    const card = await reviewCard();

    fireEvent.click(within(card).getByRole("button", { name: "Not upheld" }));
    expect(
      within(card).queryByLabelText("Corrected score (optional)"),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByLabelText("Corrected rationale (optional)"),
    ).not.toBeInTheDocument();

    fireEvent.change(within(card).getByLabelText("Note (optional)"), {
      target: { value: "The AI score is correct." },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm your review" });
    expect(within(dialog).getByText("Not upheld")).toBeInTheDocument();
    expect(within(dialog).queryByText("Corrected score")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Corrected rationale")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(mockedCreateCriterionReportReview).toHaveBeenCalledWith("report-1", {
        verdict: "notUpheld",
        note: "The AI score is correct.",
        correctedScore: null,
        correctedRationale: null,
      }),
    );
    expect(
      await screen.findByText("The report is not upheld; the AI score is maintained."),
    ).toBeInTheDocument();
    expect(within(card).queryByText("Corrected score")).not.toBeInTheDocument();
  });

  it("sends null optional fields when they are left empty", async () => {
    mockedGetCriterionReport.mockResolvedValue(makeDetail());
    mockedCreateCriterionReportReview.mockResolvedValue(
      makeReview({ note: null, correctedScore: null, correctedRationale: null }),
    );

    renderView();
    const card = await reviewCard();

    fireEvent.click(within(card).getByRole("button", { name: "Upheld" }));
    fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm your review" });
    expect(within(dialog).getByText("No note.")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Not provided.")).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(mockedCreateCriterionReportReview).toHaveBeenCalledWith("report-1", {
        verdict: "upheld",
        note: null,
        correctedScore: null,
        correctedRationale: null,
      }),
    );
  });

  it("shows only my final review, never counters or another administrator's review", async () => {
    const detailWithPrivateData = {
      ...makeDetail({ myReview: makeReview({ note: "My private note." }) }),
      reviews: [{ note: "Another admin's note." }],
      reviewCount: 3,
    } as AdminCriterionReportDetail;
    mockedGetCriterionReport.mockResolvedValue(detailWithPrivateData);

    renderView();
    const card = await reviewCard();

    expect(within(card).getByText("Final")).toBeInTheDocument();
    expect(within(card).getByText("My private note.")).toBeInTheDocument();
    expect(within(card).getByText("80%")).toBeInTheDocument();
    expect(
      within(card).getByText("The CV shows eight years of Java."),
    ).toBeInTheDocument();
    expect(within(card).getByText(/final and cannot be edited/i)).toBeInTheDocument();
    expect(within(card).queryByRole("group", { name: "Verdict" })).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: /Review and submit|Submit review/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Another admin's note.")).not.toBeInTheDocument();
    expect(screen.queryByText(/3 reviews/i)).not.toBeInTheDocument();
  });

  it("falls back honestly when the saved review has no note or corrections", async () => {
    mockedGetCriterionReport.mockResolvedValue(
      makeDetail({
        myReview: makeReview({
          note: null,
          correctedScore: null,
          correctedRationale: null,
        }),
      }),
    );

    renderView();
    const card = await reviewCard();

    expect(within(card).getByText("No note.")).toBeInTheDocument();
    expect(within(card).getAllByText("Not provided.")).toHaveLength(2);
  });

  it("isolates the report cache per administrator", async () => {
    const adminA: AuthUser = { ...adminUser, id: "admin-a", email: "a@linqorbit.local" };
    const adminB: AuthUser = { ...adminUser, id: "admin-b", email: "b@linqorbit.local" };
    mockedGetCriterionReport
      .mockResolvedValueOnce(
        makeDetail({ myReview: makeReview({ note: "Admin A private note." }) }),
      )
      .mockResolvedValueOnce(makeDetail({ myReview: null }));

    renderView("report-1", adminA);
    expect(await screen.findByText("Admin A private note.")).toBeInTheDocument();

    act(() => {
      useAuthStore.getState().setAuth({ token: "jwt-token", user: adminB });
    });

    const card = await reviewCard();
    expect(within(card).getByRole("group", { name: "Verdict" })).toBeInTheDocument();
    expect(screen.queryByText("Admin A private note.")).not.toBeInTheDocument();
    await waitFor(() => expect(mockedGetCriterionReport).toHaveBeenCalledTimes(2));
  });

  it.each([
    { status: 409, detail: "You have already reviewed this report." },
    { status: 400, detail: "Corrected score must be between 0 and 100." },
  ])(
    "keeps a $status failure visible in the confirmation",
    async ({ status, detail }) => {
      mockedGetCriterionReport.mockResolvedValue(makeDetail());
      mockedCreateCriterionReportReview.mockRejectedValue(
        Object.assign(new Error("rejected"), {
          isAxiosError: true,
          response: { status, data: { detail } },
        }),
      );

      renderView();
      const card = await reviewCard();
      fireEvent.click(within(card).getByRole("button", { name: "Upheld" }));
      fireEvent.click(within(card).getByRole("button", { name: "Review and submit" }));

      const dialog = await screen.findByRole("dialog", { name: "Confirm your review" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Submit review" }));

      expect(
        await within(dialog).findByText("Could not submit your review"),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(detail)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Submit review" })).toBeEnabled();
      expect(
        screen.getByRole("dialog", { name: "Confirm your review" }),
      ).toBeInTheDocument();
    },
  );

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
