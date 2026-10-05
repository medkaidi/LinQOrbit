import { describe, expect, it } from "vitest";

import {
  aboutSchema,
  experienceSchema,
  identityCardSchema,
  languagesSchema,
  languageSchema,
  linkSchema,
  skillSchema,
  skillsSchema,
} from "@/lib/validations/candidate.schemas";

function firstMessage(result: { error?: { issues: { message: string }[] } }): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("aboutSchema", () => {
  it("accepts a complete about section", () => {
    const result = aboutSchema.safeParse({
      title: "Backend Engineer",
      bio: "I build APIs that scale.",
      yearsOfExperience: 5,
      searchStatus: "open_to_work",
    });

    expect(result.success).toBe(true);
  });

  it("requires a title and a search status", () => {
    expect(firstMessage(aboutSchema.safeParse({ title: "", bio: "", yearsOfExperience: 0, searchStatus: "open_to_work" }))).toBe(
      "Professional title is required",
    );
    expect(
      firstMessage(
        aboutSchema.safeParse({
          title: "Backend Engineer",
          bio: "",
          yearsOfExperience: 0,
          searchStatus: "",
        }),
      ),
    ).toBe("Please select a search status");
  });

  it("keeps years of experience between 0 and 60", () => {
    expect(
      firstMessage(
        aboutSchema.safeParse({
          title: "Backend Engineer",
          bio: "",
          yearsOfExperience: 61,
          searchStatus: "selective",
        }),
      ),
    ).toBe("Years of experience must be 60 or fewer");
    expect(
      firstMessage(
        aboutSchema.safeParse({
          title: "Backend Engineer",
          bio: "",
          yearsOfExperience: Number.NaN,
          searchStatus: "selective",
        }),
      ),
    ).toBe("Years of experience is required");
  });
});

describe("identityCardSchema", () => {
  const account = {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "+1 555 000 0000",
    currentCity: "Paris",
    currentCountry: "FR",
  };

  it("accepts an empty target position and trims a filled one", () => {
    expect(identityCardSchema.safeParse({ ...account, targetPosition: "" }).success).toBe(true);

    const trimmed = identityCardSchema.safeParse({
      ...account,
      targetPosition: "  Staff Engineer  ",
    });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) {
      expect(trimmed.data.targetPosition).toBe("Staff Engineer");
    }
  });

  it("rejects a target position over 255 characters", () => {
    const result = identityCardSchema.safeParse({
      ...account,
      targetPosition: "a".repeat(256),
    });

    expect(firstMessage(result)).toBe("Target position must be 255 characters or fewer");
  });
});

describe("experienceSchema", () => {
  it("accepts an ongoing experience with an empty end date", () => {
    const result = experienceSchema.safeParse({
      positionTitle: "Backend Engineer",
      companyName: "Acme",
      companyCountry: "FR",
      startDate: "2023-04-01",
      endDate: "",
      description: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = experienceSchema.safeParse({
      positionTitle: "Backend Engineer",
      companyName: "Acme",
      companyCountry: "",
      startDate: "2023-04-01",
      endDate: "2022-01-01",
      description: "",
    });

    expect(firstMessage(result)).toBe("End date must be on or after the start date");
  });

  it("requires a start date", () => {
    const result = experienceSchema.safeParse({
      positionTitle: "Backend Engineer",
      companyName: "Acme",
      companyCountry: "",
      startDate: "",
      endDate: "",
      description: "",
    });

    expect(firstMessage(result)).toBe("Start date is required");
  });
});

describe("skillSchema", () => {
  it("requires a skill from the predefined list", () => {
    const result = skillSchema.safeParse({ skillId: "", level: 3, yearsExperience: "" });

    expect(firstMessage(result)).toBe("Select a skill");
  });

  it("keeps the level between 1 and 5", () => {
    const result = skillSchema.safeParse({
      skillId: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
      level: 7,
      yearsExperience: "4",
    });

    expect(firstMessage(result)).toBe("Level must be between 1 and 5");
  });

  it("rejects a skill already present in the payload", () => {
    const skillId = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c";
    const result = skillsSchema.safeParse({
      items: [
        { skillId, level: 3, yearsExperience: "" },
        { skillId, level: 4, yearsExperience: "" },
      ],
    });

    expect(firstMessage(result)).toBe("This skill is already in your list");
  });
});

describe("languageSchema", () => {
  it("accepts a CEFR level and rejects anything else", () => {
    const languageId = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c";

    expect(languageSchema.safeParse({ languageId, level: "C1" }).success).toBe(true);
    expect(firstMessage(languageSchema.safeParse({ languageId, level: "native" }))).toBe(
      "Select a level",
    );
  });

  it("rejects a language already present in the payload", () => {
    const languageId = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c";
    const result = languagesSchema.safeParse({
      items: [
        { languageId, level: "B2" },
        { languageId, level: "C1" },
      ],
    });

    expect(firstMessage(result)).toBe("This language is already in your list");
  });
});

describe("linkSchema", () => {
  it("accepts a profile link without certification fields", () => {
    const result = linkSchema.safeParse({
      label: "GitHub",
      url: "https://github.com/ada",
      linkType: "github",
      issuer: "",
      issuedAt: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a URL that is not http(s)", () => {
    const result = linkSchema.safeParse({
      label: "Portfolio",
      url: "ftp://example.com",
      linkType: "website",
      issuer: "",
      issuedAt: "",
    });

    expect(firstMessage(result)).toBe("Enter a valid http(s) URL");
  });

  it("requires an issue date to be a real date", () => {
    const result = linkSchema.safeParse({
      label: "AWS Solutions Architect",
      url: "https://aws.amazon.com/certification/",
      linkType: "certification",
      issuer: "AWS",
      issuedAt: "not-a-date",
    });

    expect(firstMessage(result)).toBe("Enter a valid date");
  });
});
