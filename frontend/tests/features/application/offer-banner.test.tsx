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

  it("drops the curtain over the page with the full offer, then closes it", async () => {
    getPublicJobMock.mockResolvedValue(buildPublicJob());
    renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    fireEvent.click(await screen.findByRole("button", { name: "View full job description" }));

    const curtain = screen.getByRole("dialog", { name: "Backend Engineer" });
    expect(within(curtain).getByText("Build our platform APIs.")).toBeInTheDocument();
    // Le rideau rend la fiche sans ses actions publiques.
    expect(within(curtain).queryByRole("link", { name: "Apply for this job" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(within(curtain).getByRole("button", { name: "Back to my application" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View full job description" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing until the offer is loaded", () => {
    getPublicJobMock.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQueryClient(<OfferBanner publicId="abcdefghijkl" />);

    expect(container).toBeEmptyDOMElement();
  });
});
