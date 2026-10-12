import { describe, expect, it } from "vitest";

import { toJobOfferPayload } from "@/lib/api/job-offer.api";
import type { JobOfferValues } from "@/lib/validations/job-offer.schemas";

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
});
