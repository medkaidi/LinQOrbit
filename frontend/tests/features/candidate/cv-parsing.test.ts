import { describe, expect, it } from "vitest";

import {
  applyCvToAbout,
  applyCvToExperiences,
  applyCvToSkills,
  applySkillMappings,
  planCvImport,
  type CvImportRefs,
} from "@/features/candidate/cv-parsing";
import type { ParsedCv } from "@/types/candidate";
import type { AboutValues } from "@/lib/validations/candidate.schemas";

const refs: CvImportRefs = {
  skills: [
    { id: "skill-java", name: "Java", skillType: "tech", category: "Programming Languages" },
    { id: "skill-k8s", name: "Kubernetes", skillType: "tech", category: "Cloud & DevOps" },
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

    expect(plan.skills).toEqual([
      { skillId: "skill-java", level: 4, yearsExperience: "7" },
      // Pas de niveau dans le CV : importée au niveau le plus bas.
      { skillId: "skill-k8s", level: 1, yearsExperience: "3" },
    ]);
    expect(plan.skipped).toEqual([]);
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

  it("imports a language only with a known reference, deduplicating by id", () => {
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
    expect(plan.skipped).toEqual([{ label: "German", reason: "Not in your language list" }]);
  });

  it("defaults a language without a CEFR level to A1", () => {
    const plan = planCvImport({ ...emptyCv, languages: [{ name: "French", level: null }] }, refs);

    expect(plan.languages).toEqual([{ languageId: "lang-fr", level: "A1" }]);
    expect(plan.skipped).toEqual([]);
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

describe("applySkillMappings", () => {
  const cv: ParsedCv = {
    ...emptyCv,
    skills: [
      { name: "Java", level: 4, yearsExperience: 5 },
      { name: "COBOL", level: 3, yearsExperience: 2 },
      { name: "JCL", level: 2, yearsExperience: null },
    ],
  };

  it("renames mapped skills to the chosen catalog wording", () => {
    const mapped = applySkillMappings(
      cv,
      { COBOL: "skill-java", JCL: "skill-k8s" },
      refs.skills,
    );

    expect(mapped.skills.map((skill) => skill.name)).toEqual(["Java", "Java", "Kubernetes"]);
    // Les niveaux et années du CV survivent au mapping.
    expect(mapped.skills[1]).toEqual({ name: "Java", level: 3, yearsExperience: 2 });
  });

  it("keeps unmapped skills and their wording untouched", () => {
    const mapped = applySkillMappings(cv, { COBOL: "skill-java" }, refs.skills);

    expect(mapped.skills[0]).toEqual({ name: "Java", level: 4, yearsExperience: 5 });
    expect(mapped.skills[2]).toEqual({ name: "JCL", level: 2, yearsExperience: null });
  });

  it("returns the same object when there is no effective mapping", () => {
    expect(applySkillMappings(cv, {}, refs.skills)).toBe(cv);
    expect(applySkillMappings(cv, { COBOL: "" }, refs.skills)).toBe(cv);
    expect(applySkillMappings(cv, { COBOL: "unknown-id" }, refs.skills)).toBe(cv);
  });

  it("turns a mapped skill into an importable row through planCvImport", () => {
    const mapped = applySkillMappings(cv, { COBOL: "skill-k8s" }, refs.skills);

    const plan = planCvImport(mapped, refs);

    expect(plan.skills).toEqual([
      { skillId: "skill-java", level: 4, yearsExperience: "5" },
      { skillId: "skill-k8s", level: 3, yearsExperience: "2" },
    ]);
    expect(plan.skipped).toEqual([{ label: "JCL", reason: "Not in your skill list" }]);
  });
});
