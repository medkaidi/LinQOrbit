import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { RecruiterApplicationsView } from "@/features/application/recruiter-applications-view";
import {
  decideRecruiterApplication,
  downloadRecruiterApplicationCv,
  getRecruiterApplication,
  listRecruiterApplications,
} from "@/lib/api/application.api";
import {
  buildRecruiterApplicationCard,
  buildRecruiterApplicationPage,
  RECRUITER_APPLICATION_ID,
  RECRUITER_OFFER_ID,
} from "@/tests/helpers/recruiter-application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/application.api", () => ({
  decideRecruiterApplication: vi.fn(),
  downloadRecruiterApplicationCv: vi.fn(),
  getRecruiterApplication: vi.fn(),
  listRecruiterApplications: vi.fn(),
}));

const listMock = vi.mocked(listRecruiterApplications);

function renderView() {
  return renderWithQueryClient(<RecruiterApplicationsView offerId={RECRUITER_OFFER_ID} />);
}

describe("RecruiterApplicationsView", () => {
  beforeEach(() => {
    listMock.mockReset();
    vi.mocked(decideRecruiterApplication).mockReset();
    vi.mocked(downloadRecruiterApplicationCv).mockReset();
    vi.mocked(getRecruiterApplication).mockReset();
  });

  it("renders five section scores, contests and links to the application detail", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard(),
          buildRecruiterApplicationCard({
            id: "application-2",
            candidate: { firstName: "Alan", lastName: "Turing", title: null },
            assessmentAvailable: false,
            sections: [
              { section: "requiredSkills", score: null },
              { section: "preferredSkills", score: null },
              { section: "languages", score: null },
              { section: "experience", score: null },
              { section: "education", score: null },
            ],
            contestedCount: 0,
            averageGap: null,
          }),
        ],
        total: 2,
      }),
    );

    renderView();

    expect(await screen.findByText("2 applications")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer · Acme Labs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grace Hopper" })).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );
    expect(screen.getByRole("link", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("View application")).toHaveLength(2);
    // L'action est un lien de navigation interne vers le détail de la candidature.
    expect(screen.getAllByRole("link", { name: "View application" })[0]).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );

    // Cinq barres, valeurs affichées, section de tri par défaut = date : aucune mise en avant.
    for (const label of [
      "Required skills",
      "Preferred skills",
      "Languages",
      "Experience",
      "Education",
    ]) {
      // « Experience » est aussi le libellé d'une cellule de la bande de signaux.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const score of ["60", "75", "80", "85", "90"]) {
      expect(screen.getByText(score)).toBeInTheDocument();
    }
    // L'unité est rappelée sur chaque valeur : « 60 % ».
    expect(screen.getAllByText("%")).toHaveLength(5);
    expect(screen.getByText("60").parentElement).toHaveTextContent("60%");
    const contestedPanel = screen.getByRole("group", {
      name: "Contests: 2 contested · avg gap 20 pts",
    });
    expect(within(contestedPanel).getByText("2 contested")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("Average gap")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("20 pts")).toBeInTheDocument();
    expect(screen.getByText("No AI assessment")).toBeInTheDocument();
    // Sans évaluation, le bloc contestations n'a pas de sens : « No AI assessment » suffit.
    expect(screen.queryByText("No contests")).not.toBeInTheDocument();

    expect(listMock).toHaveBeenCalledWith(
      RECRUITER_OFFER_ID,
      { status: "submitted", sort: "submittedAt", direction: "asc", page: 0 },
      { signal: expect.any(AbortSignal) },
    );
    expect(screen.getByRole("button", { name: "Submitted" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("lists the applications in a two-column grid and keeps the link to each detail", async () => {
    listMock.mockResolvedValue(buildRecruiterApplicationPage());

    renderView();

    const link = await screen.findByRole("link", { name: /View application/ });
    expect(link).toHaveAttribute(
      "href",
      `/recruiter/offers/${RECRUITER_OFFER_ID}/applications/${RECRUITER_APPLICATION_ID}`,
    );
    const list = link.closest("ul");
    expect(list).toHaveClass("grid", "grid-cols-1", "xl:grid-cols-2");
  });

  it("shows the key facts, the skills and the status with its date on the card", async () => {
    listMock.mockResolvedValue(buildRecruiterApplicationPage());

    renderView();

    const facts = await screen.findByLabelText("Key facts");
    expect(within(facts).getByText("9 years")).toBeInTheDocument();
    expect(within(facts).getByText("Senior")).toBeInTheDocument();
    expect(within(facts).getByText("France")).toBeInTheDocument();
    const skills = screen.getByRole("list", { name: "Skills" });
    expect(within(skills).getByText("Java")).toHaveAttribute("title", "Level 5 of 5");
    expect(within(skills).getByText("PostgreSQL")).toBeInTheDocument();
    // Statut et date dans l'en-tête de la carte (« Submitted » est aussi le nom d'un onglet).
    const card = screen.getByRole("link", { name: "Grace Hopper" }).closest("li") as HTMLElement;
    expect(within(card).getByText("Submitted")).toBeInTheDocument();
    expect(within(card).getByText(/^Applied /)).toBeInTheDocument();
  });

  it("keeps the three key facts and flags each missing one as Not provided", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            highlights: { seniority: null, yearsOfExperience: 1, country: null, skills: [] },
          }),
        ],
      }),
    );

    renderView();

    const facts = await screen.findByLabelText("Key facts");
    expect(within(facts).getByText("1 year")).toBeInTheDocument();
    // Séniorité et pays absents : la cellule reste, estompée.
    expect(within(facts).getAllByText("Not provided")).toHaveLength(2);
    expect(screen.getByText("No skills listed")).toBeInTheDocument();
  });

  it("flags every key fact as Not provided when the candidate has no sheet at all", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            highlights: { seniority: null, yearsOfExperience: null, country: null, skills: [] },
          }),
        ],
      }),
    );

    renderView();

    const facts = await screen.findByLabelText("Key facts");
    expect(within(facts).getAllByText("Not provided")).toHaveLength(3);
  });

  it("ignores an unknown seniority instead of printing the raw value", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            highlights: { seniority: "wizard", yearsOfExperience: 3, country: "FR", skills: [] },
          }),
        ],
      }),
    );

    renderView();

    const facts = await screen.findByLabelText("Key facts");
    expect(within(facts).getByText("3 years")).toBeInTheDocument();
    expect(within(facts).queryByText(/wizard/i)).not.toBeInTheDocument();
    expect(within(facts).getAllByText("Not provided")).toHaveLength(1);
  });

  it("lays the scores and the contests out as two equal panels, with unevaluated sections left empty", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            sections: [
              { section: "requiredSkills", score: 60 },
              { section: "preferredSkills", score: null },
              { section: "languages", score: 80 },
              { section: "experience", score: 85 },
              { section: "education", score: 90 },
            ],
          }),
        ],
      }),
    );

    renderView();

    const contests = await screen.findByRole("group", { name: /^Contests:/ });
    expect(contests.parentElement).toHaveClass("grid", "grid-cols-2");
    // Section non évaluée : texte d'état, ni pourcentage ni remplissage de barre.
    // Panneau des scores = voisin précédent du panneau de contestations (les pastilles de sections contestées
    // portent aussi des libellés de section, mais dans le panneau de contestations).
    const scores = contests.previousElementSibling as HTMLElement;
    const row = within(scores).getByText("Preferred skills").closest("div")?.parentElement as HTMLElement;
    expect(within(row).getByText("Not evaluated")).toBeInTheDocument();
    expect(within(row).queryByText("%")).not.toBeInTheDocument();
    expect(row.querySelector("[style]")).toBeNull();
    expect(screen.getAllByText("%")).toHaveLength(4);
  });

  it("highlights the section the list is sorted by", async () => {
    listMock.mockResolvedValue(buildRecruiterApplicationPage());

    renderView();

    await screen.findByRole("group", { name: /^Contests:/ });
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Languages" }));

    const rowOf = async (label: string) => {
      const link = await screen.findByRole("link", { name: "Grace Hopper" });
      return within(link.closest("li") as HTMLElement).getByText(label).closest("div")?.parentElement;
    };
    await waitFor(async () => expect(await rowOf("Languages")).toHaveClass("bg-blue-surface"));
    expect(await rowOf("Education")).not.toHaveClass("bg-blue-surface");
  });

  it("names the contested sections with their criteria count inside the contests panel", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            contestedCount: 3,
            contestedSections: [
              { section: "requiredSkills", count: 2 },
              { section: "education", count: 1 },
            ],
          }),
        ],
      }),
    );

    renderView();

    const panel = await screen.findByRole("group", { name: /^Contests:/ });
    const sections = within(panel).getByRole("list", { name: "Contested sections" });
    const items = within(sections).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Required skills·2");
    expect(items[0]).toHaveAttribute("title", "2 criteria contested");
    expect(items[1]).toHaveTextContent("Education·1");
    expect(items[1]).toHaveAttribute("title", "1 criterion contested");
    // Le panneau des scores n'est pas touché : aucune pastille de contestation sur ses lignes.
    const scores = panel.previousElementSibling as HTMLElement;
    expect(within(scores).queryByRole("list")).not.toBeInTheDocument();
    expect(within(scores).queryByText("·")).not.toBeInTheDocument();
  });

  it("renders no contested sections list without contest, without assessment or without section data", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({ contestedCount: 0, averageGap: null, contestedSections: [] }),
          buildRecruiterApplicationCard({
            id: "application-2",
            candidate: { firstName: "Alan", lastName: "Turing", title: null },
            assessmentAvailable: false,
            contestedCount: 0,
            averageGap: null,
            contestedSections: [],
          }),
          buildRecruiterApplicationCard({
            id: "application-3",
            candidate: { firstName: "Edsger", lastName: "Dijkstra", title: null },
            contestedCount: 1,
            contestedSections: [],
          }),
        ],
        total: 3,
      }),
    );

    renderView();

    await screen.findByText("3 applications");
    expect(screen.queryByRole("list", { name: "Contested sections" })).not.toBeInTheDocument();
  });

  it("renders the scores and contests row only when an AI assessment exists", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard(),
          buildRecruiterApplicationCard({
            id: "application-2",
            candidate: { firstName: "Alan", lastName: "Turing", title: null },
            assessmentAvailable: false,
            contestedCount: 0,
            averageGap: null,
          }),
        ],
        total: 2,
      }),
    );

    renderView();

    expect(await screen.findByRole("group", { name: /^Contests:/ })).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /^Contests:/ })).toHaveLength(1);
    expect(screen.getByText("No AI assessment")).toBeInTheDocument();
  });

  it("omits a missing or blank candidate title instead of rendering a placeholder", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            candidate: { firstName: "Alan", lastName: "Turing", title: "   " },
          }),
        ],
      }),
    );

    renderView();

    expect(await screen.findByRole("link", { name: "Alan Turing" })).toBeInTheDocument();
    expect(screen.queryByText("Senior Backend Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("Not provided")).not.toBeInTheDocument();
  });

  it("colors the rounded score with the band of the displayed value", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            contestedCount: 0,
            averageGap: null,
            sections: [
              { section: "requiredSkills", score: 69.5 },
              { section: "preferredSkills", score: null },
              { section: "languages", score: null },
              { section: "experience", score: null },
              { section: "education", score: null },
            ],
          }),
        ],
        total: 1,
      }),
    );

    renderView();

    // La valeur arrondie affichée porte la couleur de sa bande (« 70 » → vert).
    expect((await screen.findByText("70")).parentElement).toHaveClass("text-success-text");
  });

  it("renders No contests and Not evaluated for an assessed application without gaps", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [
          buildRecruiterApplicationCard({
            contestedCount: 0,
            averageGap: null,
            sections: [
              { section: "requiredSkills", score: 60 },
              { section: "preferredSkills", score: null },
              { section: "languages", score: 80 },
              { section: "experience", score: 85 },
              { section: "education", score: 90 },
            ],
          }),
        ],
        total: 1,
      }),
    );

    renderView();

    expect(await screen.findByText("1 application")).toBeInTheDocument();
    const noContestsPanel = screen.getByRole("group", { name: "Contests: No contests" });
    expect(within(noContestsPanel).getByText("No contests")).toBeInTheDocument();
    expect(within(noContestsPanel).getByText("All scores uncontested")).toBeInTheDocument();
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.queryByText("No AI assessment")).not.toBeInTheDocument();
  });

  it("keeps the contest count and reports an unavailable gap when no average exists", async () => {
    listMock.mockResolvedValue(
      buildRecruiterApplicationPage({
        items: [buildRecruiterApplicationCard({ contestedCount: 3, averageGap: null })],
        total: 1,
      }),
    );

    renderView();

    expect(await screen.findByText("1 application")).toBeInTheDocument();
    const contestedPanel = screen.getByRole("group", { name: "Contests: 3 contested" });
    expect(within(contestedPanel).getByText("3 contested")).toBeInTheDocument();
    expect(within(contestedPanel).getByText("Not available")).toBeInTheDocument();
  });

  it("filters by tab, sorts by section and contests, and starts from the empty state", async () => {
    listMock.mockImplementation(async (_offerId, params) =>
      params?.status === "accepted"
        ? buildRecruiterApplicationPage({ items: [], total: 0 })
        : buildRecruiterApplicationPage(),
    );

    renderView();
    await screen.findByText("Grace Hopper");

    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));

    expect(await screen.findByText("No accepted applications yet.")).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "accepted", sort: "submittedAt", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Submitted" }));
    await screen.findByText("Grace Hopper");

    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Required skills" }));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "requiredSkills", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Desc" }));
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "requiredSkills", direction: "desc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Contests" }));
    expect(screen.getByText("Fixed order")).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        RECRUITER_OFFER_ID,
        { status: "submitted", sort: "contests", direction: "asc", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );
  });
});
