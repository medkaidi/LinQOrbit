import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { OfferBanner } from "@/features/application/offer-banner";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import { buildPublicJob } from "@/tests/helpers/public-job-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/public-jobs.api", () => ({
  getPublicJob: vi.fn(),
  getRelatedPublicJobs: vi.fn(),
  listPublicJobs: vi.fn(),
}));

const getPublicJobMock = vi.mocked(getPublicJob);

describe("OfferBanner", () => {
  beforeEach(() => {
    getPublicJobMock.mockReset();
    document.body.style.overflow = "";
  });

  it("shows the key facts and the mandatory skills by weight", async () => {
    getPublicJobMock.mockResolvedValue(buildPublicJob());

    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    const banner = await screen.findByRole("region", { name: "Job offer summary" });
    expect(within(banner).getByText("Nimbus Labs")).toBeInTheDocument();
    expect(within(banner).getByText("Paris, France")).toBeInTheDocument();
    expect(within(banner).getByText("5+ years of experience")).toBeInTheDocument();
    expect(within(banner).getByText("60,000 – 75,000 EUR per year")).toBeInTheDocument();
    // Compétences clés : obligatoires seulement, poids décroissant (Kubernetes 5 avant Java 3).
    const skills = within(banner).getAllByText(/^(Kubernetes|Java|React)$/).map((node) => node.textContent);
    expect(skills).toEqual(["Kubernetes", "Java"]);
  });

  it("omits the facts the offer does not state", async () => {
    getPublicJobMock.mockResolvedValue(
      buildPublicJob({ city: null, country: null, requiredExpYear: null, salaryMin: null, salaryMax: null,
        companyName: null, skills: [] }),
    );

    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    const banner = await screen.findByRole("region", { name: "Job offer summary" });
    expect(within(banner).queryByText(/years of experience/)).not.toBeInTheDocument();
    expect(within(banner).queryByText("Key skills")).not.toBeInTheDocument();
    expect(within(banner).queryByText(/EUR/)).not.toBeInTheDocument();
  });

  it("unfolds the card downward in place from the footer toggle, then folds it back", async () => {
    getPublicJobMock.mockResolvedValue(buildPublicJob());
    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    const banner = await screen.findByRole("region", { name: "Job offer summary" });
    const toggle = within(banner).getByRole("button", { name: "View full job description" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Replié : le détail n'est ni monté ni exposé aux technologies d'assistance.
    expect(screen.queryByRole("region", { name: "Full job description" })).not.toBeInTheDocument();
    expect(screen.queryByText("Build our platform APIs.")).not.toBeInTheDocument();
    fireEvent.click(toggle);

    // Déplié dans la carte même, entre le résumé et le pied — aucun voile.
    const detail = within(banner).getByRole("region", { name: "Full job description" });
    expect(within(detail).getByText("Build our platform APIs.")).toBeInTheDocument();
    expect(within(detail).queryByRole("link", { name: "Apply for this job" })).not.toBeInTheDocument();
    // Aucun en-tête répété : titre et société ne figurent qu'une fois, dans le résumé.
    expect(within(banner).getAllByText("Backend Engineer")).toHaveLength(1);
    expect(within(banner).getAllByText("Nimbus Labs")).toHaveLength(1);
    expect(detail).not.toHaveAttribute("inert");
    // Le même bouton bascule : son libellé et son état suivent, le focus ne bouge pas.
    expect(toggle).toHaveAccessibleName("Hide full job description");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", detail.id);

    fireEvent.click(toggle);
    expect(screen.queryByRole("region", { name: "Full job description" })).not.toBeInTheDocument();
    expect(toggle).toHaveAccessibleName("View full job description");
    expect(document.getElementById(detail.id)).toHaveAttribute("inert");
    // Aucun verrou de défilement : la page défile normalement.
    expect(document.body.style.overflow).toBe("");
  });

  it("renders nothing until the offer is loaded", () => {
    getPublicJobMock.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps at most five mandatory skills, heaviest first", async () => {
    const skills = ["A", "B", "C", "D", "E", "F"].map((name, index) => ({
      skillId: `k${index}`,
      name,
      requirementType: "mandatory" as const,
      weight: index + 1,
      yearsExperience: null,
    }));
    getPublicJobMock.mockResolvedValue(buildPublicJob({ skills }));

    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    const banner = await screen.findByRole("region", { name: "Job offer summary" });
    const shown = within(banner).getAllByText(/^[A-F]$/).map((node) => node.textContent);
    expect(shown).toEqual(["F", "E", "D", "C", "B"]);
  });

  it("shows no company line when the offer has no company", async () => {
    getPublicJobMock.mockResolvedValue(buildPublicJob({ companyName: null }));

    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    const banner = await screen.findByRole("region", { name: "Job offer summary" });
    expect(within(banner).queryByText("Nimbus Labs")).not.toBeInTheDocument();
    expect(within(banner).getByText("Backend Engineer")).toBeInTheDocument();
  });
});
