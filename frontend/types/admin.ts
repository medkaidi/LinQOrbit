import type { PublicJob } from "@/types/public-job";
import type { NormalizedCandidateProfile, NormalizedJobOffer } from "@/types/normalized";

/** Compte tel qu'exposé par l'administration (GET /api/v1/admin/users). */
export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "INACTIVE";
  /** Codes SMALLINT des rôles de capacité (1 = ADMIN). */
  roles: number[];
};

/** Fiche détail d'un compte (GET /api/v1/admin/users/{userId}) — jamais le hash. */
export type AdminUserDetail = AdminUser & {
  phone: string | null;
  /** Valeurs API : "male" | "female" | "other". */
  sex: string | null;
  homeCountry: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  createdAt: string;
  hasCandidateProfile: boolean;
  hasRecruiterProfile: boolean;
};

/** Statut du job de normalisation (minuscules, miroir backend). */
export type NormalizationJobStatus = "pending" | "running" | "done" | "failed" | "superseded";

/** Enveloppe d'une fiche normalisée (candidat v2 ou offre v1). */
export type AdminNormalizedProfile<T> = {
  profileId: string;
  version: number;
  schemaVersion: string;
  validatedAt: string;
  jobStatus: NormalizationJobStatus | null;
  /** Contenu canonique pass-through ; null = job en cours, échec ou jamais rempli. */
  content: T | null;
};

export type AdminCandidateNormalizedProfile = AdminNormalizedProfile<NormalizedCandidateProfile>;

export type AdminOfferNormalizedProfile = AdminNormalizedProfile<NormalizedJobOffer>;

/** Statut de vie d'une offre (valeurs API backend). */
export type AdminJobOfferStatus = "draft" | "validated" | "published" | "closed";

/** Ligne de la liste globale des offres (GET /api/v1/admin/job-offers). */
export type AdminJobOfferListItem = {
  id: string;
  title: string;
  status: AdminJobOfferStatus;
  companyName: string | null;
  publicId: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  publishedAt: string | null;
  normalizationJobStatus: NormalizationJobStatus | null;
};

/** Page de la liste globale des offres (page 0-based). */
export type AdminJobOfferPage = {
  items: AdminJobOfferListItem[];
  page: number;
  size: number;
  total: number;
};

/** Détail d'une offre côté admin : fiche publique sans gate + statut de vie. */
export type AdminJobOfferDetail = {
  id: string;
  status: AdminJobOfferStatus;
  createdAt: string;
  updatedAt: string;
  detail: PublicJob;
};

/** Suggestion de compétence en file de revue (GET /api/v1/admin/skill-suggestions). */
export type AdminSkillSuggestion = {
  id: string;
  name: string;
  candidateId: string;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  candidateEmail: string | null;
  createdAt: string;
};
