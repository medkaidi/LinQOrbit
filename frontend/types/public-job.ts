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

/**
 * Ligne du job board public (T-72) — `GET /api/v1/jobs`. Vue légère : ni
 * description ni autres listes enfants (réservées à la fiche), toutes les
 * compétences exposées en libellés (T-76, transparence candidat — poids
 * décroissant puis nom côté backend), vocabulaires déjà résolus en labels.
 */
export type PublicJobListItem = {
  publicId: string;
  slug: string;
  title: string;
  companyName: string | null;
  seniority: string | null;
  city: string | null;
  country: string | null;
  contractType: string | null;
  employmentType: string | null;
  workMode: string | null;
  skills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
};

/** Enveloppe D34 du job board : `size` est la valeur effective appliquée par le backend. */
export type PublicJobPage = {
  items: PublicJobListItem[];
  page: number;
  size: number;
  total: number;
};
