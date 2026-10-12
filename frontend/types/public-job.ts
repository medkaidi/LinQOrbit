import type { JobOfferLanguageOption, JobOfferSkillOption } from "@/types/recruiter";

/**
 * Fiche publique d'une offre publiée (V15) — `GET /api/v1/jobs/{publicId}`.
 * Volontairement distincte de `JobOffer` (gestion) : ni recruiterId, ni
 * statut, ni dirty-flag ; les vocabulaires sont déjà résolus en labels.
 */
export type PublicJob = {
  publicId: string;
  slug: string;
  title: string;
  description: string | null;
  seniority: string | null;
  requiredExpYear: number | null;
  city: string | null;
  country: string | null;
  companyName: string | null;
  contractType: string | null;
  employmentType: string | null;
  workMode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  expiresAt: string | null;
  skills: JobOfferSkillOption[];
  languages: JobOfferLanguageOption[];
  degreeLabels: string[];
  studyFieldLabels: string[];
  publishedAt: string | null;
};
