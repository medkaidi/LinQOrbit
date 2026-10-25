import { describe, expect, it, vi } from "vitest";

import {
  getRecruiterDashboard,
  listJobOffers,
  revalidateJobOffer,
  toJobOfferPayload,
} from "@/lib/api/job-offer.api";
import type { JobOfferValues } from "@/lib/validations/job-offer.schemas";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from "@/lib/api/axios";

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);

const COMPANY_ID = "33333333-3333-4333-8333-333333333333";

const emptyValues: JobOfferValues = {
  title: "Backend Engineer",
  description: "",
  seniority: "",
  requiredExpYear: "",
  city: "",
  country: "",
  contractTypeId: "",
  employmentTypeId: "",
  workModeId: "",
  expiresAt: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "",
  salaryPeriod: "",
  skills: [],
  languages: [],
  degreeIds: [],
  studyFieldIds: [],
  questions: [],
  maxClarificationQuestions: "3",
};

describe("toJobOfferPayload", () => {
  it("converts empty strings and numeric strings to null / numbers", () => {
    const payload = toJobOfferPayload(
      {
        ...emptyValues,
        requiredExpYear: "3",
        salaryMin: "50000",
        salaryMax: "70000.5",
        city: "Paris",
        country: "FR",
      },
      COMPANY_ID,
    );

    expect(payload.companyId).toBe(COMPANY_ID);
    expect(payload.description).toBeNull();
    expect(payload.seniority).toBeNull();
    expect(payload.requiredExpYear).toBe(3);
    expect(payload.city).toBe("Paris");
    expect(payload.country).toBe("FR");
    expect(payload.salaryMin).toBe(50000);
    expect(payload.salaryMax).toBe(70000.5);
    expect(payload.salaryPeriod).toBeNull();
  });

  it("drops skill and language rows without a reference", () => {
    const payload = toJobOfferPayload(
      {
        ...emptyValues,
        skills: [
          {
            skillId: "a0000000-0000-4000-8000-000000000001",
            requirementType: "mandatory",
            weight: "4",
            yearsExperience: "2",
          },
          { skillId: "", requirementType: "preferred", weight: "2", yearsExperience: "" },
        ],
        languages: [
          {
            languageId: "b0000000-0000-4000-8000-000000000002",
            level: "B2",
            isRequired: true,
          },
          { languageId: "", level: "", isRequired: false },
        ],
        degreeIds: ["c0000000-0000-4000-8000-000000000003", ""],
        studyFieldIds: [],
      },
      COMPANY_ID,
    );

    expect(payload.skills).toHaveLength(1);
    expect(payload.skills[0]).toEqual({
      skillId: "a0000000-0000-4000-8000-000000000001",
      requirementType: "mandatory",
      weight: 4,
      yearsExperience: 2,
    });
    expect(payload.languages).toHaveLength(1);
    expect(payload.languages[0]).toEqual({
      languageId: "b0000000-0000-4000-8000-000000000002",
      level: "B2",
      isRequired: true,
    });
    expect(payload.degreeIds).toEqual(["c0000000-0000-4000-8000-000000000003"]);
    expect(payload.studyFieldIds).toEqual([]);
    expect(payload.questions).toEqual([]);
  });

  it("derives question and option sort orders from their index and drops options outside choice types", () => {
    const payload = toJobOfferPayload(
      {
        ...emptyValues,
        questions: [
          {
            label: "Where?",
            type: "single_choice",
            isRequired: true,
            options: [
              { label: "Remote", preferred: true },
              { label: "On-site", preferred: false },
            ],
          },
          {
            label: "Tell us more",
            type: "text",
            isRequired: false,
            // Ligne fantôme impossible par l'UI (le changement de type vide les
            // options) — la couche API masque quand même : jamais d'options hors choix.
            options: [{ label: "Stale", preferred: false }],
          },
        ],
      },
      COMPANY_ID,
    );

    expect(payload.questions).toEqual([
      {
        label: "Where?",
        type: "single_choice",
        isRequired: true,
        sortOrder: 0,
        options: [
          { label: "Remote", preferred: true, sortOrder: 0 },
          { label: "On-site", preferred: false, sortOrder: 1 },
        ],
      },
      {
        label: "Tell us more",
        type: "text",
        isRequired: false,
        sortOrder: 1,
        options: [],
      },
    ]);
  });

  it("sanitizes rich description HTML before sending", () => {
    const payload = toJobOfferPayload(
      {
        ...emptyValues,
        description: '<h2>Role</h2><p>Ship <strong>weekly</strong>.</p><script>alert(1)</script>',
      },
      COMPANY_ID,
    );

    expect(payload.description).toBe("<h2>Role</h2><p>Ship <strong>weekly</strong>.</p>");
  });

  it("treats an empty rich document as null", () => {
    const payload = toJobOfferPayload(
      { ...emptyValues, description: "<p></p>" },
      COMPANY_ID,
    );

    expect(payload.description).toBeNull();
  });

  it("sends the AI questions cap as a number, and null when left empty (server default)", () => {
    expect(toJobOfferPayload({ ...emptyValues, maxClarificationQuestions: "0" }, COMPANY_ID).maxClarificationQuestions).toBe(0);
    expect(toJobOfferPayload({ ...emptyValues, maxClarificationQuestions: "10" }, COMPANY_ID).maxClarificationQuestions).toBe(10);
    expect(toJobOfferPayload({ ...emptyValues, maxClarificationQuestions: "" }, COMPANY_ID).maxClarificationQuestions).toBeNull();
  });
});

describe("listJobOffers", () => {
  it("sends no key at all when page is absent", async () => {
    mockedGet.mockResolvedValue({ data: { items: [], page: 0, size: 20, total: 0 } });

    await listJobOffers();

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/job-offers", {
      params: {},
      signal: undefined,
    });
  });

  it("sends only the page when defined, and never a size", async () => {
    mockedGet.mockResolvedValue({ data: { items: [], page: 2, size: 20, total: 50 } });

    await listJobOffers({ page: 2 });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/job-offers", {
      params: { page: 2 },
      signal: undefined,
    });
  });

  it("transmits every filter that is set, next to the page", async () => {
    mockedGet.mockResolvedValue({ data: { items: [], page: 1, size: 20, total: 0 } });

    await listJobOffers({
      page: 1,
      q: "backend",
      status: "published",
      workModeId: "wm1",
      contractTypeId: "ct1",
      employmentTypeId: "et1",
      seniority: "senior",
      companyId: "c1",
      expiry: "expiringSoon",
    });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/job-offers", {
      params: {
        page: 1,
        q: "backend",
        status: "published",
        workModeId: "wm1",
        contractTypeId: "ct1",
        employmentTypeId: "et1",
        seniority: "senior",
        companyId: "c1",
        expiry: "expiringSoon",
      },
      signal: undefined,
    });
  });

  it("omits every empty filter instead of sending a blank value", async () => {
    mockedGet.mockResolvedValue({ data: { items: [], page: 0, size: 20, total: 0 } });

    await listJobOffers({
      page: 0,
      q: "",
      workModeId: "",
      contractTypeId: undefined,
      employmentTypeId: "",
      companyId: "",
    });

    const params = mockedGet.mock.calls[0][1]?.params;
    expect(params).toEqual({ page: 0 });
    expect(params).not.toHaveProperty("size");
  });
});

describe("revalidateJobOffer", () => {
  it("posts to the dedicated revalidate endpoint, never to validate", async () => {
    mockedPost.mockResolvedValue({ data: undefined });

    await revalidateJobOffer("o1");

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith("/api/v1/job-offers/o1/revalidate");
  });
});

describe("getRecruiterDashboard", () => {
  it("reads the aggregated figures in a single call, with no filter or page size", async () => {
    const body = {
      offers: { draft: 1, validated: 0, published: 2, closed: 0 },
      liveOffers: 2,
      closingSoon: { count: 1, nextExpiry: "2026-11-03" },
      applications: { toReview: 4, accepted: 1, rejected: 0 },
      candidates: { toInvite: 3, invited: 1, searchesFailed: 0 },
      attention: [],
    };
    mockedGet.mockResolvedValue({ data: body });

    expect(await getRecruiterDashboard()).toEqual(body);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/recruiters/me/dashboard");
  });
});
