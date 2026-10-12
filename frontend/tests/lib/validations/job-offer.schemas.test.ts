import { describe, expect, it } from "vitest";

import {
  createJobOfferSchema,
  updateJobOfferSchema,
} from "@/lib/validations/job-offer.schemas";

const validRow = {
  skillId: "a0000000-0000-4000-8000-000000000001",
  requirementType: "mandatory" as const,
  weight: "3" as const,
  yearsExperience: "",
};

const baseValues = {
  companyId: "33333333-3333-4333-8333-333333333333",
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
};

describe("createJobOfferSchema", () => {
  it("accepts a minimal draft", () => {
    expect(createJobOfferSchema.safeParse(baseValues).success).toBe(true);
  });

  it("accepts a rich description up to 20000 characters and rejects more", () => {
    const max = createJobOfferSchema.safeParse({
      ...baseValues,
      description: "<p>".padEnd(20000, "a"),
    });
    expect(max.success).toBe(true);

    const tooLong = createJobOfferSchema.safeParse({
      ...baseValues,
      description: "a".repeat(20001),
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues.some((issue) => issue.path.includes("description"))).toBe(true);
    }
  });

  it("rejects a missing title", () => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, title: " " });
    expect(result.success).toBe(false);
  });

  it("rejects a salary range where the maximum is below the minimum", () => {
    const result = createJobOfferSchema.safeParse({
      ...baseValues,
      salaryMin: "90000",
      salaryMax: "70000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("salaryMax"))).toBe(true);
    }
  });

  it("accepts a coherent salary range", () => {
    const result = createJobOfferSchema.safeParse({
      ...baseValues,
      salaryMin: "50000",
      salaryMax: "70000",
      salaryCurrency: "EUR",
      salaryPeriod: "year",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown seniority", () => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, seniority: "rockstar" });
    expect(result.success).toBe(false);
  });

  it("rejects a weight outside 1-5", () => {
    const result = createJobOfferSchema.safeParse({
      ...baseValues,
      skills: [{ ...validRow, weight: "7" as unknown as "3" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires a level when a language is picked", () => {
    const result = createJobOfferSchema.safeParse({
      ...baseValues,
      languages: [
        {
          languageId: "b0000000-0000-4000-8000-000000000002",
          level: "",
          isRequired: true,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("level") && issue.message === "Pick a level",
        ),
      ).toBe(true);
    }
  });

  it("rejects a country that is not a 2-letter code", () => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, country: "France" });
    expect(result.success).toBe(false);
  });

  it("accepts years of experience between 0 and 60 and rejects above", () => {
    expect(createJobOfferSchema.safeParse({ ...baseValues, requiredExpYear: "0" }).success).toBe(
      true,
    );
    expect(
      createJobOfferSchema.safeParse({ ...baseValues, requiredExpYear: "60" }).success,
    ).toBe(true);

    const tooMany = createJobOfferSchema.safeParse({ ...baseValues, requiredExpYear: "61" });
    expect(tooMany.success).toBe(false);
    if (!tooMany.success) {
      expect(tooMany.error.issues.some((issue) => issue.path.includes("requiredExpYear"))).toBe(
        true,
      );
    }

    expect(
      createJobOfferSchema.safeParse({
        ...baseValues,
        skills: [{ ...validRow, yearsExperience: "99" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a duplicated skill and a duplicated language", () => {
    const skillId = "a0000000-0000-4000-8000-000000000001";
    const languageId = "b0000000-0000-4000-8000-000000000002";
    const result = createJobOfferSchema.safeParse({
      ...baseValues,
      skills: [
        { ...validRow, skillId },
        { ...validRow, skillId },
      ],
      languages: [
        { languageId, level: "B2", isRequired: true },
        { languageId, level: "C1", isRequired: false },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "skills" &&
            issue.path[2] === "skillId" &&
            issue.message === "This skill is already in your list",
        ),
      ).toBe(true);
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path[0] === "languages" &&
            issue.path[2] === "languageId" &&
            issue.message === "This language is already in your list",
        ),
      ).toBe(true);
    }
  });
});

describe("updateJobOfferSchema", () => {
  it("shares the same refinements as create", () => {
    const result = updateJobOfferSchema.safeParse({
      ...baseValues,
      salaryMin: "10",
      salaryMax: "5",
    });
    expect(result.success).toBe(false);
  });
});
