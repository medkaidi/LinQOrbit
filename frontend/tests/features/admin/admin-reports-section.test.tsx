import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    listCriterionReports: vi.fn(),
  };
});

import { listCriterionReports } from "@/lib/api/admin.api";
import { AdminReportsSection } from "@/features/admin/admin-reports-section";
import type { AdminCriterionReport, AdminCriterionReportPage } from "@/types/admin";

const mockedListCriterionReports = vi.mocked(listCriterionReports);

function makeReport(overrides: Partial<AdminCriterionReport> = {}): AdminCriterionReport {
  return {
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
    ...overrides,
  };
}

function makePage(
  items: AdminCriterionReport[],
  overrides: Partial<AdminCriterionReportPage> = {},
): AdminCriterionReportPage {
  return { items, page: 0, size: 20, total: items.length, ...overrides };
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminReportsSection />
    </QueryClientProvider>,
  );
}

describe("AdminReportsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the reports with the criterion, the offer, the candidate and the author", async () => {
    mockedListCriterionReports.mockResolvedValue(
      makePage([
        makeReport(),
        makeReport({
          id: "report-2",
          criterionKey: "language:english",
          criterionLabel: "English",
          section: "languages",
          score: 80,
          sectionScore: 80,
          reason: "other",
          comment: "The offer is ambiguous.",
          candidateFirstName: "Alan",
          candidateLastName: "Turing",
        }),
      ]),
    );

    renderSection();

    expect(await screen.findByText("Java")).toBeInTheDocument();
    // Le libellé, la section et la clé sont relus par le serveur.
    expect(screen.getByText("Required skills")).toBeInTheDocument();
    expect(screen.getByText("skill:java")).toBeInTheDocument();
    expect(screen.getByText("The score is wrong")).toBeInTheDocument();
    expect(screen.getByText("The CV shows eight years of Java.")).toBeInTheDocument();
    expect(screen.getAllByText("Backend Engineer")).toHaveLength(2);
    expect(screen.getAllByText("Acme")).toHaveLength(2);
    expect(screen.getAllByText("Ada Owner")).toHaveLength(2);
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getAllByText("Oct 20, 2026")).toHaveLength(2);

    // Les deux scores réels du résultat épinglé sont affichés sur chaque carte.
    expect(
      screen.getByRole("group", { name: "Criterion score: 60%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Section score: 60%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Criterion score: 80%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Section score: 80%" }),
    ).toBeInTheDocument();

    // Deuxième signalement : motif « other » et section différente.
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("language:english")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();

    // Chaque ligne s'ouvre sur son dossier admin.
    expect(screen.getAllByRole("link", { name: "View" })[0]).toHaveAttribute(
      "href",
      "/admin/reports/report-1",
    );
    expect(screen.getAllByRole("link", { name: "View" })[1]).toHaveAttribute(
      "href",
      "/admin/reports/report-2",
    );
  });

  it("shows unresolved scores and an explicit empty comment", async () => {
    mockedListCriterionReports.mockResolvedValue(
      makePage([
        makeReport({
          score: null,
          sectionScore: null,
          comment: null,
        }),
      ]),
    );

    renderSection();

    expect(await screen.findByText("Java")).toBeInTheDocument();
    expect(screen.getAllByText("Not resolved")).toHaveLength(2);
    expect(
      screen.getByRole("group", { name: "Criterion score: Not resolved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Section score: Not resolved" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No comment.")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("requests the first page without a size and follows the backend decision", async () => {
    mockedListCriterionReports.mockResolvedValue(makePage([makeReport()], { total: 1 }));

    renderSection();

    await screen.findByText("Java");
    expect(mockedListCriterionReports).toHaveBeenCalledWith(
      { page: 0 },
      { signal: expect.any(AbortSignal) },
    );
    expect(screen.getByText("1 report")).toBeInTheDocument();
  });

  it("loads the next page through the load-more fallback", async () => {
    mockedListCriterionReports.mockResolvedValue(makePage([makeReport()], { total: 45 }));

    renderSection();

    await screen.findByText("Java");
    expect(screen.getByText("45 reports")).toBeInTheDocument();

    mockedListCriterionReports.mockClear();
    mockedListCriterionReports.mockResolvedValue(
      makePage([makeReport({ id: "report-2", criterionLabel: "English" })], {
        page: 1,
        total: 45,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(mockedListCriterionReports).toHaveBeenCalledWith(
        { page: 1 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(await screen.findByText("English")).toBeInTheDocument();
  });

  it("shows an empty state when no assessment was reported", async () => {
    mockedListCriterionReports.mockResolvedValue(makePage([], { total: 0 }));

    renderSection();

    expect(
      await screen.findByText("No AI assessment has been reported yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 reports")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "AI reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("surfaces a load error with a retry that re-queries", async () => {
    mockedListCriterionReports.mockRejectedValueOnce(new Error("boom"));

    renderSection();

    expect(await screen.findByText("Unable to load the AI reports.")).toBeInTheDocument();
    expect(
      screen.queryByText("No AI assessment has been reported yet."),
    ).not.toBeInTheDocument();

    mockedListCriterionReports.mockResolvedValue(makePage([makeReport()]));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Java")).toBeInTheDocument();
  });
});
