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

// Base minimale valide : title + description + country + employmentTypeId + ≥1 skill.
const baseValues = {
  companyId: "33333333-3333-4333-8333-333333333333",
  title: "Backend Engineer",
  description: "<p>Build APIs.</p>",
  seniority: "",
  requiredExpYear: "",
  city: "",
  country: "FR",
  contractTypeId: "",
  employmentTypeId: "e0000000-0000-4000-8000-0000000000e1",
  workModeId: "",
  expiresAt: "",
  salaryMin: "",
  salaryMax: "",
  salaryCurrency: "",
  salaryPeriod: "",
  skills: [validRow],
  languages: [],
  degreeIds: [],
  studyFieldIds: [],
  questions: [],
  maxClarificationQuestions: "3",
};

describe("createJobOfferSchema", () => {
  it("accepts a minimal complete offer", () => {
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

  it("rejects an empty description and an editor-only empty markup", () => {
    for (const description of ["", "   ", "<p></p>", "<p><br></p>"]) {
      const result = createJobOfferSchema.safeParse({ ...baseValues, description });
      expect(result.success, `description=${JSON.stringify(description)}`).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("description") && issue.message === "Description is required",
          ),
        ).toBe(true);
      }
    }
  });

  it("rejects a missing country and a country that is not a 2-letter code", () => {
    for (const country of ["", "France", "f"]) {
      const result = createJobOfferSchema.safeParse({ ...baseValues, country });
      expect(result.success, `country=${JSON.stringify(country)}`).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("country") && issue.message === "Pick a country",
          ),
        ).toBe(true);
      }
    }
  });

  it("rejects a missing employment type", () => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, employmentTypeId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("employmentTypeId") &&
            issue.message === "Pick an employment type",
        ),
      ).toBe(true);
    }
  });

  it("rejects an offer without any skill", () => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, skills: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.includes("skills") &&
            issue.message === "Add at least one skill",
        ),
      ).toBe(true);
    }
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

  it("rejects an empty question label and an empty option label", () => {
    const blankQuestion = createJobOfferSchema.safeParse({
      ...baseValues,
      questions: [{ label: "  ", type: "text", isRequired: false, options: [] }],
    });
    expect(blankQuestion.success).toBe(false);

    const blankOption = createJobOfferSchema.safeParse({
      ...baseValues,
      questions: [
        {
          label: "Where?",
          type: "single_choice",
          isRequired: false,
          options: [{ label: "", preferred: false }],
        },
      ],
    });
    expect(blankOption.success).toBe(false);
    if (!blankOption.success) {
      expect(
        blankOption.error.issues.some(
          (issue) =>
            issue.path.join(".") === "questions.0.options.0.label" &&
            issue.message === "Option label is required",
        ),
      ).toBe(true);
    }
  });

  it("rejects a choice question without options and accepts it with options", () => {
    const withoutOptions = createJobOfferSchema.safeParse({
      ...baseValues,
      questions: [{ label: "Where?", type: "multiple_choice", isRequired: true, options: [] }],
    });
    expect(withoutOptions.success).toBe(false);
    if (!withoutOptions.success) {
      expect(
        withoutOptions.error.issues.some(
          (issue) =>
            issue.path.join(".") === "questions.0.options" &&
            issue.message === "Add at least one option",
        ),
      ).toBe(true);
    }

    const complete = createJobOfferSchema.safeParse({
      ...baseValues,
      questions: [
        {
          label: "Where?",
          type: "multiple_choice",
          isRequired: true,
          options: [
            { label: "Remote", preferred: true },
            { label: "On-site", preferred: false },
          ],
        },
        { label: "Years with Java?", type: "number", isRequired: false, options: [] },
      ],
    });
    expect(complete.success).toBe(true);
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

  it("requires the same completeness as create", () => {
    const incomplete = updateJobOfferSchema.safeParse({
      ...baseValues,
      description: "<p></p>",
      country: "",
      employmentTypeId: "",
      skills: [],
    });
    expect(incomplete.success).toBe(false);
    if (!incomplete.success) {
      const messages = incomplete.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Description is required");
      expect(messages).toContain("Pick a country");
      expect(messages).toContain("Pick an employment type");
      expect(messages).toContain("Add at least one skill");
    }
  });
});

describe("maxClarificationQuestions", () => {
  const capMessages = (value: string) => {
    const result = createJobOfferSchema.safeParse({ ...baseValues, maxClarificationQuestions: value });
    return result.success
      ? []
      : result.error.issues
          .filter((issue) => issue.path.includes("maxClarificationQuestions"))
          .map((issue) => issue.message);
  };

  it.each(["0", "3", "10", ""])("accepts %j (empty = server default)", (value) => {
    expect(capMessages(value)).toEqual([]);
  });

  it("mirrors the backend bounds messages", () => {
    expect(capMessages("-1")).toEqual(["Max AI questions must be at least 0"]);
    expect(capMessages("11")).toEqual(["Max AI questions must be at most 10"]);
  });

  it.each(["2.5", "abc", "1e1"])("rejects the non-integer %j", (value) => {
    expect(capMessages(value)).toEqual(["Max AI questions must be a whole number"]);
  });

  it("applies to updates as well", () => {
    expect(updateJobOfferSchema.safeParse({ ...baseValues, maxClarificationQuestions: "11" }).success).toBe(false);
  });
});
