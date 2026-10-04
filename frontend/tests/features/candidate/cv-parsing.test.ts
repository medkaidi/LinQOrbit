import { describe, expect, it } from "vitest";

import {
  applyCvToAbout,
  applyCvToExperiences,
  applyCvToSkills,
  planCvImport,
  type CvImportRefs,
} from "@/features/candidate/cv-parsing";
import type { ParsedCv } from "@/lib/api/candidate.api";
import type { AboutValues } from "@/lib/validations/candidate.schemas";

const refs: CvImportRefs = {
  skills: [
    { id: "skill-java", name: "Java", skillType: "tech" },
    { id: "skill-k8s", name: "Kubernetes", skillType: "tech" },
  ],
  languages: [{ id: "lang-fr", symbol: "fr", name: "French" }],
  degrees: [{ id: "degree-master", label: "Master" }],
  studyFields: [{ id: "field-cs", label: "Computer Science" }],
};

const emptyCv: ParsedCv = {
  title: null,
  summary: null,
  experiences: [],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
};

describe("planCvImport", () => {
  it("turns CV months into ISO dates and keeps null end dates empty", () => {
    const plan = planCvImport({
      ...emptyCv,
      experiences: [
        {
          positionTitle: "Backend Engineer",
          companyName: "Acme",
          companyCountry: "France",
          startDate: "2021-03",
          endDate: null,
          description: null,
        },
      ],
    });

    expect(plan.experiences).toEqual([
      {
        positionTitle: "Backend Engineer",
        companyName: "Acme",
        companyCountry: "FR",
        startDate: "2021-03-01",
        endDate: "",
        description: "",
      },
    ]);
  });

  it("resolves skills against the reference list, case-insensitively", () => {
    const plan = planCvImport(
      {
        ...emptyCv,
        skills: [
          { name: "java", level: 4, yearsExperience: 7 },
          { name: "Kubernetes", level: null, yearsExperience: 3 },
        ],
      },
      refs,
    );

    expect(plan.skills).toEqual([{ skillId: "skill-java", level: 4, yearsExperience: "7" }]);
    expect(plan.skipped).toEqual([
      { label: "Kubernetes", reason: "No proficiency level in the CV" },
    ]);
  });

  it("skips a skill that is not in the predefined list and deduplicates the rest", () => {
    const plan = planCvImport(
      {
        ...emptyCv,
        skills: [
          { name: "COBOL", level: 3, yearsExperience: 2 },
          { name: "Java", level: 5, yearsExperience: 10 },
          { name: "java", level: 2, yearsExperience: 1 },
        ],
      },
      refs,
    );

    expect(plan.skills).toEqual([{ skillId: "skill-java", level: 5, yearsExperience: "10" }]);
    expect(plan.skipped).toEqual([{ label: "COBOL", reason: "Not in your skill list" }]);
  });

  it("imports a language only with a known reference and a CEFR level", () => {
    const plan = planCvImport(
      {
        ...emptyCv,
        languages: [
          { name: "French", level: "C1" },
          { name: "German", level: "B1" },
          { name: "French", level: null },
        ],
      },
      refs,
    );

    expect(plan.languages).toEqual([{ languageId: "lang-fr", level: "C1" }]);
    expect(plan.skipped).toEqual([
      { label: "German", reason: "Not in your language list" },
      { label: "French", reason: "No CEFR level in the CV" },
    ]);
  });

  it("resolves degree labels against the catalogues and leaves unknown ones empty", () => {
    const plan = planCvImport({
      ...emptyCv,
      diplomas: [
        {
          title: "MSc Computer Science",
          institution: "Sorbonne University",
          institutionCountry: "France",
          degreeLabel: "master",
          studyFieldLabel: "Philosophy",
          startDate: "2016-09",
          endDate: "2018-06",
        },
      ],
    }, refs);

    expect(plan.diplomas).toEqual([
      {
        title: "MSc Computer Science",
        institution: "Sorbonne University",
        institutionCountry: "FR",
        degreeId: "degree-master",
        studyFieldId: "",
        startDate: "2016-09-01",
        endDate: "2018-06-01",
      },
    ]);
  });

  it("infers the link type from the host and drops invalid or duplicate URLs", () => {
    const plan = planCvImport({
      ...emptyCv,
      links: [
        { label: "GitHub", url: "https://github.com/ada" },
        { label: "Portfolio", url: "https://example.com/work" },
        { label: "GitHub again", url: "https://github.com/ada" },
        { label: "Broken", url: "not-a-url" },
      ],
    });

    expect(plan.links).toEqual([
      {
        label: "GitHub",
        url: "https://github.com/ada",
        linkType: "github",
        issuer: "",
        issuedAt: "",
      },
      {
        label: "Portfolio",
        url: "https://example.com/work",
        linkType: "website",
        issuer: "",
        issuedAt: "",
      },
    ]);
    expect(plan.skipped).toEqual([{ label: "Broken", reason: "Invalid URL" }]);
  });
});

describe("applyCvTo…", () => {
  const defaults: AboutValues = {
    title: "Backend Engineer",
    bio: "I build APIs.",
    yearsOfExperience: 5,
    searchStatus: "open_to_work",
  };

  it("replaces the title and bio only when the CV provides them", () => {
    const withTitle = planCvImport({ ...emptyCv, title: "Staff Engineer" });
    expect(applyCvToAbout(defaults, withTitle)).toEqual({
      ...defaults,
      title: "Staff Engineer",
    });

    const withoutTitle = planCvImport(emptyCv);
    expect(applyCvToAbout(defaults, withoutTitle)).toEqual(defaults);
  });

  it("keeps the current lists when the CV has none", () => {
    const currentSkills = [{ skillId: "skill-java", level: 3, yearsExperience: "" }];
    const plan = planCvImport(emptyCv, refs);
    expect(applyCvToSkills(currentSkills, plan)).toEqual(currentSkills);

    const currentExperiences = [
      {
        positionTitle: "Dev",
        companyName: "Acme",
        companyCountry: "FR",
        startDate: "2023-04-01",
        endDate: "",
        description: "",
      },
    ];
    expect(applyCvToExperiences(currentExperiences, plan)).toEqual(currentExperiences);
  });
});
