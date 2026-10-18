import type { PublicJob } from "@/types/public-job";

/** Offre publiée complète (bandeau et rideau du parcours de candidature). */
export function buildPublicJob(overrides: Partial<PublicJob> = {}): PublicJob {
  return {
    publicId: "abcdefghijkl",
    slug: "backend-engineer",
    title: "Backend Engineer",
    description: "<p>Build our platform APIs.</p>",
    seniority: "senior",
    requiredExpYear: 5,
    city: "Paris",
    country: "France",
    companyName: "Nimbus Labs",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Remote",
    salaryMin: 60000,
    salaryMax: 75000,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    expiresAt: null,
    skills: [
      { skillId: "s1", name: "Java", requirementType: "mandatory", weight: 3, yearsExperience: null },
      { skillId: "s2", name: "Kubernetes", requirementType: "mandatory", weight: 5, yearsExperience: null },
      { skillId: "s3", name: "React", requirementType: "preferred", weight: 2, yearsExperience: null },
    ],
    languages: [{ languageId: "l1", symbol: "en", name: "English", level: "C1", isRequired: true }],
    degreeLabels: ["Master"],
    studyFieldLabels: ["Computer science"],
    publishedAt: "2026-10-10T09:00:00",
    ...overrides,
  };
}
