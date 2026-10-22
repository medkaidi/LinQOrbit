import type { PublicJob } from "@/types/public-job";
import type {
  CriterionReportReason,
  RecruiterAssessmentView,
  RecruiterContestationView,
} from "@/types/application";
import type {
  JobOfferStatusValue,
  SalaryPeriodValue,
  SeniorityValue,
} from "@/types/recruiter";
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
  hasCandidateProfile: boolean;
  hasRecruiterProfile: boolean;
};

/** Page de comptes (enveloppe backend, page 0-based — D34). */
export type AdminUserPage = {
  items: AdminUser[];
  page: number;
  size: number;
  total: number;
};

/**
 * Filtres de la liste des comptes (T-48) — valeurs API en minuscules comme le
 * backend (`status` : active | inactive ; `capability` : identité de profil).
 */
export type AdminUserFilters = {
  q?: string;
  status?: "active" | "inactive";
  capability?: "candidate" | "recruiter";
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
};

/** Statut du job de normalisation (minuscules, miroir backend). */
type NormalizationJobStatus = "pending" | "running" | "done" | "failed" | "superseded";

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

/** Statut de vie d'une offre (valeurs API backend) — même union que la carte recruteur (TD-042). */
export type AdminJobOfferStatus = JobOfferStatusValue;

/** Ligne de la liste globale des offres (GET /api/v1/admin/job-offers) — mêmes signaux que la carte recruteur. */
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
  seniority: SeniorityValue | null;
  city: string | null;
  country: string | null;
  contractTypeId: string | null;
  workModeId: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriodValue | null;
  hasUnvalidatedChanges: boolean;
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

/**
 * Signalement interne d'une évaluation IA (D66) — lu par la console
 * d'administration. Le libellé du critère et sa section sont relus dans le
 * résultat épinglé par le serveur.
 */
export type AdminCriterionReport = {
  id: string;
  criterionKey: string;
  criterionLabel: string;
  /** Clé de section (camelCase) ; absente si la section n'est pas résolue. */
  section: string | null;
  reason: CriterionReportReason;
  comment: string | null;
  createdAt: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  offerId: string | null;
  offerTitle: string | null;
  companyName: string | null;
};

/** Page de signalements (page 0-based — enveloppe backend). */
export type AdminCriterionReportPage = {
  items: AdminCriterionReport[];
  page: number;
  size: number;
  total: number;
};

/**
 * Critère signalé relu dans **le résultat épinglé** (D66) : score et score de
 * section, exigence et justification IA. `resolved=false` quand la clé a
 * disparu du résultat — la page affiche alors le signalement sans note.
 */
export type AdminCriterionContext = {
  key: string;
  label: string;
  section: string | null;
  score: number | null;
  sectionScore: number | null;
  requirement: string | null;
  rationale: string | null;
  resolved: boolean;
};

/**
 * Dossier complet d'un signalement IA (T-86, D66) : contexte de notation,
 * évaluation complète en lecture seule et contestations du candidat. Aucune
 * de ces données n'est modifiable — un signalement ne rejoue pas l'évaluation.
 */
export type AdminCriterionReportDetail = {
  report: AdminCriterionReport;
  candidateUserId: string | null;
  criterion: AdminCriterionContext;
  assessment: RecruiterAssessmentView;
  contests: RecruiterContestationView[];
  averageGap: number | null;
};
