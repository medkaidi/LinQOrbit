import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { RecruiterApplicationDetailView } from "@/features/application/recruiter-application-detail-view";
import {
  decideRecruiterApplication,
  downloadRecruiterApplicationCv,
  getRecruiterApplication,
  listRecruiterApplications,
  reportCriterion,
} from "@/lib/api/application.api";
import {
  buildRecruiterApplicationDetail,
  RECRUITER_APPLICATION_ID,
  RECRUITER_OFFER_ID,
} from "@/tests/helpers/recruiter-application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/application.api", () => ({
  decideRecruiterApplication: vi.fn(),
  downloadRecruiterApplicationCv: vi.fn(),
  getRecruiterApplication: vi.fn(),
  listRecruiterApplications: vi.fn(),
  reportCriterion: vi.fn(),
}));

const detailMock = vi.mocked(getRecruiterApplication);
const decideMock = vi.mocked(decideRecruiterApplication);
const downloadMock = vi.mocked(downloadRecruiterApplicationCv);
const reportMock = vi.mocked(reportCriterion);

function renderDetail() {
  return renderWithQueryClient(
    <RecruiterApplicationDetailView
      offerId={RECRUITER_OFFER_ID}
      applicationId={RECRUITER_APPLICATION_ID}
    />,
  );
}

/**
 * Titre de la page (h1) — on attend la donnée via le sous-titre de l'offre
 * (élément peu coûteux), puis on lit le h1 par niveau : la requête par nom
 * accessible sur l'en-tête (monogramme + nom + poste actuel) est coûteuse et
 * peut dépasser le délai d'attente sous charge.
 */
async function findPageTitle() {
  await screen.findByText("Application for Backend Engineer · Acme Labs");
  return screen.getByRole("heading", { level: 1 });
}

describe("RecruiterApplicationDetailView", () => {
  beforeEach(() => {
    detailMock.mockReset();
    decideMock.mockReset();
    downloadMock.mockReset();
    reportMock.mockReset();
    vi.mocked(listRecruiterApplications).mockReset();
  });

  it("shows the candidate identity, the current title, the status and the pinned CV", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());

    renderDetail();

    // Le monogramme est décoratif ; le titre porte le nom puis le poste actuel.
    const heading = await findPageTitle();
    expect(heading).toHaveTextContent("Grace Hopper");
    expect(heading).toHaveTextContent("Senior Backend Engineer");
    expect(screen.getByText("GH")).toBeInTheDocument();
    expect(screen.getByText("Application for Backend Engineer · Acme Labs")).toBeInTheDocument();
    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText(/Applied Oct 15, 2026/)).toBeInTheDocument();

    const cv = within(screen.getByRole("region", { name: "CV" }));
    expect(cv.getByText("grace-hopper-cv.pdf")).toBeInTheDocument();
    expect(cv.getByText("24 KB")).toBeInTheDocument();
  });

  it("downloads the pinned CV and links back to the application list", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    downloadMock.mockResolvedValue(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Download CV" }));
    await waitFor(() =>
      expect(downloadMock).toHaveBeenCalledWith(
        RECRUITER_OFFER_ID,
        RECRUITER_APPLICATION_ID,
        "grace-hopper-cv.pdf",
      ),
    );

    // Le retour à la liste est un changement de page : un lien, pas un CTA.
    const back = screen.getByRole("link", { name: "Back to applications" });
    expect(back).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications`,
    );
  });

  it("shows the pinned assessment by section and criterion, with a blue bar per criterion", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    expect(assessment.getByText("Pinned matching result")).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Required skills" })).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Preferred skills" })).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Languages" })).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Education" })).toBeInTheDocument();

    // Score de section : pourcentage, la couleur suit la valeur affichée.
    expect(assessment.getByText("60").parentElement).toHaveTextContent("60%");
    expect(assessment.getByText("60").parentElement).toHaveClass("text-orange-deep");
    expect(assessment.getByText("80").parentElement).toHaveClass("text-success-text");

    // Critère : exigence, score, barre bleue et justification IA.
    expect(assessment.getByText("Strong Java")).toBeInTheDocument();
    expect(assessment.getByText("55").parentElement).toHaveTextContent("55%");
    expect(
      assessment.getByRole("meter", { name: "Java" }),
    ).toHaveAttribute("aria-valuenow", "55");
    expect(assessment.getByText("Solid Java experience, but the depth is partial.")).toBeInTheDocument();
  });

  it("flags the contested criterion and compares the scores in the contest panel", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    // Un seul critère correspond à une contestation : le critère « Java ».
    expect(assessment.getAllByText("Contested")).toHaveLength(1);

    const contests = within(screen.getByRole("region", { name: "Contests" }));
    expect(contests.getByText("2 contested")).toBeInTheDocument();
    // L'écart moyen vient du serveur, comme sur la carte de liste.
    expect(contests.getByText("Average gap")).toBeInTheDocument();
    expect(contests.getByText("20 pts")).toBeInTheDocument();
    expect(contests.getByText("Disagreement signal, not a quality score")).toBeInTheDocument();
    expect(contests.getByText("80")).toBeInTheDocument();
    expect(contests.getByText("70")).toBeInTheDocument();
    expect(contests.getByText("10 pts")).toBeInTheDocument();
    expect(contests.getByText("30 pts")).toBeInTheDocument();
    // L'argumentaire n'existe que là où le candidat a écrit quelque chose.
    expect(contests.getByText("Candidate's argument")).toBeInTheDocument();
    expect(contests.getByText("I write English docs every day.")).toBeInTheDocument();
  });

  it("shows the recruiter answers with preferred options and the Dynamic Candidate Assessment", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());

    renderDetail();

    const questions = within(await screen.findByRole("region", { name: "Recruiter questions" }));
    expect(questions.getByText("3 answers")).toBeInTheDocument();
    expect(questions.getByText("Why this role?")).toBeInTheDocument();
    expect(questions.getByText("I love APIs")).toBeInTheDocument();
    expect(questions.getByText("On site")).toBeInTheDocument();
    expect(questions.getAllByText("Preferred")).toHaveLength(2);

    const clarifications = within(screen.getByRole("region", { name: "Dynamic Candidate Assessment" }));
    expect(clarifications.getByText("1 exchange")).toBeInTheDocument();
    expect(clarifications.getByText("Why did you choose Java?")).toBeInTheDocument();
    expect(clarifications.getByText("Why the AI asked this")).toBeInTheDocument();
    expect(clarifications.getByText("To refine the skill assessment.")).toBeInTheDocument();
    // La mention d'état décrit la réponse : elle est junto à son libellé.
    expect(clarifications.getByText("Answer")).toBeInTheDocument();
    expect(clarifications.getByText("Answered")).toBeInTheDocument();
    expect(clarifications.getByText("Because I use it daily.")).toBeInTheDocument();
  });

  it("says no assessment question was asked when the exchange list is empty", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail({ clarifications: [] }));

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "Dynamic Candidate Assessment" }));
    expect(assessment.getByText("0 exchanges")).toBeInTheDocument();
    expect(assessment.getByText("No assessment questions were asked.")).toBeInTheDocument();
  });

  it("confirms an accept decision before recording it", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    decideMock.mockResolvedValue(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    const dialog = screen.getByRole("dialog", { name: "Accept this application?" });
    expect(dialog).toBeInTheDocument();
    expect(decideMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Accept application" }));

    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith(
        RECRUITER_OFFER_ID,
        RECRUITER_APPLICATION_ID,
        "accepted",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Accept this application?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("confirms a reject decision before recording it", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    decideMock.mockResolvedValue(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(screen.getByRole("dialog", { name: "Reject this application?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject application" }));

    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith(
        RECRUITER_OFFER_ID,
        RECRUITER_APPLICATION_ID,
        "rejected",
      ),
    );
  });

  it("explains why the decision is unavailable without the right to decide", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail({ canDecide: false }));

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Grace Hopper");
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Only the owner of this company or the recruiter who created this offer can accept or reject this application.",
      ),
    ).toBeInTheDocument();
  });

  it("does not offer a decision on an already decided application", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({ status: "accepted", canDecide: false }),
    );

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Grace Hopper");
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This application was already accepted — the decision is final and the AI assessment was not recalculated.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the absence of an AI assessment and hides the contest panel", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({
        assessment: { available: false, sections: [] },
        contests: [],
      }),
    );

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    expect(
      assessment.getByText("No AI assessment was attached to this application."),
    ).toBeInTheDocument();
    // Sans évaluation, le panneau des contestations n'a pas de sens.
    expect(screen.queryByRole("region", { name: "Contests" })).not.toBeInTheDocument();
  });

  it("marks an unevaluated section and keeps the criteria it still carries", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({
        assessment: {
          available: true,
          sections: [
            {
              section: "requiredSkills",
              score: null,
              criteria: [
                {
                  key: "skill:java",
                  label: "Java",
                  requirement: null,
                  weight: 4,
                  score: 55,
                  rationale: "Solid Java experience.",
                },
              ],
            },
            { section: "preferredSkills", score: null, criteria: [] },
            { section: "languages", score: null, criteria: [] },
            { section: "experience", score: null, criteria: [] },
            { section: "education", score: null, criteria: [] },
          ],
        },
      }),
    );

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    expect(assessment.getByText("Not evaluated")).toBeInTheDocument();
    expect(assessment.getByRole("heading", { name: "Required skills" })).toBeInTheDocument();
    // Les sections sans score ni critère ne sont pas affichées.
    expect(assessment.queryByRole("heading", { name: "Education" })).not.toBeInTheDocument();
    expect(assessment.getByText("Solid Java experience.")).toBeInTheDocument();
  });

  it("reports a missing pinned CV and disables its download", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail({ cv: null }));

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Grace Hopper");
    const cv = within(screen.getByRole("region", { name: "CV" }));
    expect(cv.getByText("No CV pinned")).toBeInTheDocument();
    expect(cv.getByRole("button", { name: "Download CV" })).toBeDisabled();
  });

  it("omits a missing candidate title", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({
        candidate: { firstName: "Alan", lastName: "Turing", title: "   " },
      }),
    );

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Alan Turing");
    expect(screen.queryByText("Senior Backend Engineer")).not.toBeInTheDocument();
  });

  it("falls back to a generic name when the candidate is unknown", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail({ candidate: null }));

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Candidate");
  });

  it("reports an unreadable submission date instead of inventing one", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({ submittedAt: "not-a-date" }),
    );

    renderDetail();

    expect(await findPageTitle()).toHaveTextContent("Grace Hopper");
    expect(screen.getByText("Submission date unavailable")).toBeInTheDocument();
  });

  it("surfaces a loading failure and lets the recruiter retry", async () => {
    detailMock.mockRejectedValue({ isAxiosError: true, response: { data: { detail: "boom" } } });

    renderDetail();

    expect(await screen.findByText("Could not load this application")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(detailMock).toHaveBeenCalledTimes(2));
  });

  it("shows a 409 conflict when another tab already decided", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    decideMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { detail: "This application has already been decided." },
      },
    });

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject application" }));

    expect(await screen.findByText("Decision failed")).toBeInTheDocument();
    expect(screen.getByText("This application has already been decided.")).toBeInTheDocument();
  });

  it("offers a report action on each criterion of the pinned assessment", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    reportMock.mockResolvedValue(undefined);

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    const reportButton = assessment.getByRole("button", { name: "Report" });
    expect(assessment.queryByText("1 reported")).not.toBeInTheDocument();
    fireEvent.click(reportButton);

    const dialog = screen.getByRole("dialog", { name: "Report this assessment" });
    expect(dialog).toBeInTheDocument();
    // Le motif est obligatoire ; « other » exige un commentaire.
    expect(screen.getByRole("button", { name: /Send report/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("combobox", { name: "Reason" }));
    fireEvent.click(screen.getByRole("option", { name: "The score is wrong" }));
    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));

    await waitFor(() =>
      expect(reportMock).toHaveBeenCalledWith(RECRUITER_OFFER_ID, RECRUITER_APPLICATION_ID, {
        criterionKey: "skill:java",
        reason: "scoreIncorrect",
        comment: null,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Report this assessment" })).not.toBeInTheDocument(),
    );
  });

  it("marks a criterion already reported, reads the report back and drops its report action", async () => {
    detailMock.mockResolvedValue(
      buildRecruiterApplicationDetail({
        criterionReports: [
          {
            criterionKey: "skill:java",
            reason: "scoreIncorrect",
            comment: "The candidate has eight years of Java, not three.",
            createdAt: "2026-10-20T10:00:00",
          },
        ],
      }),
    );

    renderDetail();

    const assessment = within(await screen.findByRole("region", { name: "AI assessment" }));
    const reported = assessment.getByText("Reported");
    expect(reported).toBeInTheDocument();
    // Le signalement ne transforme pas la carte du critère : conteneur standard.
    const card = assessment.getByRole("meter", { name: "Java" }).closest("li");
    expect(card).toHaveClass("bg-item-surface/50");
    expect(card).not.toHaveClass("bg-orange-subtle");
    // Le compteur de section évite de dérouler tous les critères pour trouver le signalement.
    expect(assessment.getByText("1 reported")).toBeInTheDocument();
    // L'auteur relit son signalement : motif, commentaire et date, sur une ligne orange discrète.
    expect(reported.parentElement).toHaveClass("text-orange-deep");
    expect(assessment.getByText("The score is wrong")).toBeInTheDocument();
    expect(
      assessment.getByText("The candidate has eight years of Java, not three."),
    ).toBeInTheDocument();
    expect(assessment.getByText("Oct 20, 2026")).toBeInTheDocument();
    // Un signalement est immuable : on ne peut pas le refaire.
    expect(assessment.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("shows the error when the criterion was already reported", async () => {
    detailMock.mockResolvedValue(buildRecruiterApplicationDetail());
    reportMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { detail: "You have already reported this criterion." },
      },
    });

    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Reason" }));
    fireEvent.click(screen.getByRole("option", { name: "The score is wrong" }));
    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));

    expect(
      await screen.findByText("You have already reported this criterion."),
    ).toBeInTheDocument();
  });
});
