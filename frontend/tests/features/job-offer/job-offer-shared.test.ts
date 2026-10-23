import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canRefreshOfferAnalysis,
  expiryCountdown,
  isOfferExpired,
  locationLabel,
  parsePublicId,
  publicJobMetaLine,
  relativeTimeLabel,
  salaryLabel,
  seniorityLabel,
  toArticleModel,
  toPublicJobArticleModel,
} from "@/features/job-offer/job-offer-shared";
import type { PublicJob } from "@/types/public-job";

const PUBLIC_JOB: PublicJob = {
  publicId: "abcdefghijkl",
  slug: "backend-engineer",
  title: "Backend Engineer",
  description: "<p>Build APIs.</p>",
  seniority: "senior",
  requiredExpYear: 5,
  city: "Paris",
  country: "France",
  companyName: "Acme",
  contractType: "Permanent",
  employmentType: "Full-time",
  workMode: "Hybrid",
  salaryMin: 60000,
  salaryMax: 75000,
  salaryCurrency: "EUR",
  salaryPeriod: "year",
  expiresAt: "2026-11-30",
  skills: [
    { skillId: "s1", name: "Java", requirementType: "mandatory", weight: 5, yearsExperience: 3 },
  ],
  languages: [
    { languageId: "l1", symbol: "en", name: "English", level: "C1", isRequired: true },
  ],
  degreeLabels: ["Master"],
  studyFieldLabels: ["Computer science"],
  publishedAt: "2026-10-10T09:00:00",
};

describe("parsePublicId", () => {
  it("reads the 12-char base36 publicId before the slug", () => {
    expect(parsePublicId("abcdefghijkl-backend-engineer")).toBe("abcdefghijkl");
    expect(parsePublicId("0123456789az-x")).toBe("0123456789az");
  });

  it("rejects a malformed segment", () => {
    expect(parsePublicId("")).toBeNull();
    expect(parsePublicId("abcdefghijkl")).toBeNull();
    expect(parsePublicId("abc-backend")).toBeNull();
    expect(parsePublicId("ABCDEFGHIJKL-backend")).toBeNull();
    expect(parsePublicId("abcdefghijk_-backend")).toBeNull();
  });
});

describe("canRefreshOfferAnalysis", () => {
  const healthy = {
    normalizationInProgress: false,
    normalizationFailed: false,
    analysisOutdated: false,
    hasUnvalidatedChanges: false,
  };

  it("offers a refresh when the analysis failed, is outdated or the offer changed", () => {
    expect(canRefreshOfferAnalysis({ ...healthy, normalizationFailed: true })).toBe(true);
    expect(canRefreshOfferAnalysis({ ...healthy, analysisOutdated: true })).toBe(true);
    expect(canRefreshOfferAnalysis({ ...healthy, hasUnvalidatedChanges: true })).toBe(true);
  });

  it("stays silent for a healthy offer or while an analysis is in progress", () => {
    expect(canRefreshOfferAnalysis(healthy)).toBe(false);
    expect(
      canRefreshOfferAnalysis({
        ...healthy,
        normalizationInProgress: true,
        analysisOutdated: true,
      }),
    ).toBe(false);
  });
});

describe("salaryLabel", () => {
  it("formats a full range with currency and period", () => {
    expect(salaryLabel(60000, 75000, "EUR", "year")).toBe("60,000 – 75,000 EUR per year");
  });

  it("formats an open range from either bound", () => {
    expect(salaryLabel(60000, null, null, null)).toBe("From 60,000");
    expect(salaryLabel(null, 75000, "EUR", null)).toBe("Up to 75,000 EUR");
  });

  it("returns null without any bound", () => {
    expect(salaryLabel(null, null, "EUR", "year")).toBeNull();
  });

  it("keeps a zero bound (not treated as absent)", () => {
    expect(salaryLabel(0, 1000, null, "month")).toBe("0 – 1,000 per month");
  });
});

describe("locationLabel", () => {
  it("joins city and country, skipping absent parts", () => {
    expect(locationLabel("Paris", "France")).toBe("Paris, France");
    expect(locationLabel(null, "France")).toBe("France");
    expect(locationLabel("Paris", null)).toBe("Paris");
  });

  it("returns null when both are absent or empty", () => {
    expect(locationLabel(null, null)).toBeNull();
    expect(locationLabel("", "")).toBeNull();
  });
});

describe("seniorityLabel", () => {
  it("resolves known values", () => {
    expect(seniorityLabel("junior")).toBe("Junior");
    expect(seniorityLabel("principal")).toBe("Principal");
  });

  it("returns null for absent, empty or unknown values", () => {
    expect(seniorityLabel(null)).toBeNull();
    expect(seniorityLabel("")).toBeNull();
    expect(seniorityLabel("staff")).toBeNull();
  });
});

describe("date helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("relativeTimeLabel", () => {
    it("picks the coarsest fitting unit", () => {
      expect(relativeTimeLabel(new Date(2026, 9, 17, 11, 55).toISOString())).toBe("5 minutes ago");
      expect(relativeTimeLabel(new Date(2026, 9, 17, 9, 0).toISOString())).toBe("3 hours ago");
      expect(relativeTimeLabel(new Date(2026, 9, 16, 12, 0).toISOString())).toBe("yesterday");
      expect(relativeTimeLabel(new Date(2026, 9, 14, 12, 0).toISOString())).toBe("3 days ago");
      expect(relativeTimeLabel(new Date(2026, 7, 17, 12, 0).toISOString())).toBe("2 months ago");
      expect(relativeTimeLabel(new Date(2024, 9, 17, 12, 0).toISOString())).toBe("2 years ago");
    });

    it("returns null for an unreadable date", () => {
      expect(relativeTimeLabel("not-a-date")).toBeNull();
    });
  });

  describe("expiryCountdown", () => {
    it("flags today and tomorrow as urgent", () => {
      expect(expiryCountdown("2026-10-17")).toEqual({ label: "Expires today", urgent: true });
      expect(expiryCountdown("2026-10-18")).toEqual({ label: "Expires tomorrow", urgent: true });
    });

    it("counts days up to 30, urgent within a week", () => {
      expect(expiryCountdown("2026-10-24")).toEqual({ label: "Expires in 7 days", urgent: true });
      expect(expiryCountdown("2026-10-25")).toEqual({ label: "Expires in 8 days", urgent: false });
      expect(expiryCountdown("2026-11-16")).toEqual({ label: "Expires in 30 days", urgent: false });
    });

    it("stays silent beyond 30 days, in the past or on an unreadable date", () => {
      expect(expiryCountdown("2026-11-17")).toBeNull();
      expect(expiryCountdown("2026-10-16")).toBeNull();
      expect(expiryCountdown("garbage")).toBeNull();
    });

    it("ignores a time part after the date", () => {
      expect(expiryCountdown("2026-10-18T23:59:00")).toEqual({
        label: "Expires tomorrow",
        urgent: true,
      });
    });
  });

  describe("isOfferExpired", () => {
    it("is true only for a published offer past its expiry date", () => {
      expect(isOfferExpired({ status: "published", expiresAt: "2026-10-16" })).toBe(true);
      expect(isOfferExpired({ status: "published", expiresAt: "2026-10-17" })).toBe(false);
      expect(isOfferExpired({ status: "published", expiresAt: null })).toBe(false);
      expect(isOfferExpired({ status: "closed", expiresAt: "2026-10-01" })).toBe(false);
      expect(isOfferExpired({ status: "draft", expiresAt: "2026-10-01" })).toBe(false);
    });
  });
});

describe("publicJobMetaLine", () => {
  it("lists the resolved meta parts in order", () => {
    expect(publicJobMetaLine(PUBLIC_JOB)).toEqual([
      "Acme",
      "Paris, France",
      "Senior",
      "Permanent",
      "Full-time",
      "Hybrid",
      "60,000 – 75,000 EUR per year",
    ]);
  });

  it("skips every absent part", () => {
    expect(
      publicJobMetaLine({
        ...PUBLIC_JOB,
        companyName: null,
        city: null,
        country: null,
        seniority: null,
        contractType: null,
        employmentType: null,
        workMode: null,
        salaryMin: null,
        salaryMax: null,
      }),
    ).toEqual([]);
  });
});

describe("article mapping", () => {
  it("maps a public job with its backend-resolved labels", () => {
    expect(toPublicJobArticleModel(PUBLIC_JOB)).toEqual({
      companyName: "Acme",
      title: "Backend Engineer",
      seniority: "Senior",
      location: "Paris, France",
      contractType: "Permanent",
      employmentType: "Full-time",
      workMode: "Hybrid",
      salary: "60,000 – 75,000 EUR per year",
      requiredExpYear: 5,
      publishedAt: "2026-10-10T09:00:00",
      expiresAt: "2026-11-30",
      description: "<p>Build APIs.</p>",
      skills: [{ id: "s1", name: "Java", requirementType: "mandatory" }],
      languages: [{ id: "l1", name: "English", level: "C1" }],
      degreeLabels: ["Master"],
      studyFieldLabels: ["Computer science"],
    });
  });

  it("takes the labels from the caller and the raw fields from the source", () => {
    const article = toArticleModel(
      { ...PUBLIC_JOB, seniority: null, salaryMin: null, salaryMax: null, skills: [], languages: [] },
      {
        companyName: null,
        contractType: "Freelance",
        employmentType: null,
        workMode: "Remote",
        degreeLabels: [],
        studyFieldLabels: [],
      },
    );
    expect(article).toMatchObject({
      companyName: null,
      contractType: "Freelance",
      employmentType: null,
      workMode: "Remote",
      seniority: null,
      salary: null,
      skills: [],
      languages: [],
      degreeLabels: [],
      studyFieldLabels: [],
    });
  });
});
