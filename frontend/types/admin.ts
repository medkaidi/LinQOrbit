import type { PublicJob } from "@/types/public-job";
import type {
  CriterionReportReason,
  RecruiterAssessmentView,
  RecruiterContestationView,
} from "@/types/application";
import type {
  JobOfferFilters,
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

/**
 * Filtres facultatifs de la liste globale des offres (T-110), combinés en ET :
 * ceux de la liste recruteur, sans la société (la console admin n'est jamais
 * restreinte par société). `q` cherche dans le titre **et** le nom de la société.
 */
export type AdminJobOfferFilters = Omit<JobOfferFilters, "companyId">;

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
  /** Score du critère relu dans le résultat épinglé ; null si non résolu. */
  score: number | null;
  /** Score de la section relu dans le résultat épinglé ; null si absent. */
  sectionScore: number | null;
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
  /**
   * Verdict de **l'admin courant** sur ce signalement (T-99) : `null` quand
   * aucun avis n'a encore été déposé (« Pending » côté UI). Jamais le verdict
   * d'un autre admin, jamais un compteur.
   */
  myReviewVerdict: AdminCriterionReportReviewVerdict | null;
};

/** Page de signalements (page 0-based — enveloppe backend). */
export type AdminCriterionReportPage = {
  items: AdminCriterionReport[];
  page: number;
  size: number;
  total: number;
};

/**
 * Critère signalé relu dans **le résultat épinglé** (D66, D79) : score et
 * score de section, exigence, justification IA et modèle réellement appelé.
 * `modelName=null` pour un résultat antérieur au schéma 2 ou une analyse
 * 100 % déterministe. `resolved=false` quand la clé a disparu du résultat —
 * la page affiche alors le signalement sans note.
 */
export type AdminCriterionContext = {
  key: string;
  label: string;
  section: string | null;
  score: number | null;
  sectionScore: number | null;
  requirement: string | null;
  rationale: string | null;
  modelName: string | null;
  resolved: boolean;
};

/** Verdict de la revue interne (T-96, D77/D78) — valeurs API exactes. */
export type AdminCriterionReportReviewVerdict = "upheld" | "notUpheld";

/**
 * Avis final de l'admin courant sur un signalement (T-96, D77/D78). Le
 * dossier n'expose jamais que cet avis : ni liste, ni compteur, ni existence
 * d'un avis d'autrui.
 */
export type AdminCriterionReportReview = {
  id: string;
  verdict: AdminCriterionReportReviewVerdict;
  note: string | null;
  correctedScore: number | null;
  correctedRationale: string | null;
  createdAt: string;
};

/** Corps de `POST …/criterion-reports/{id}/reviews` (corrections déjà masquées si non upheld). */
export type AdminCriterionReportReviewPayload = {
  verdict: AdminCriterionReportReviewVerdict;
  note: string | null;
  correctedScore: number | null;
  correctedRationale: string | null;
};

/**
 * Dossier complet d'un signalement IA (T-86, D66) : contexte de notation,
 * évaluation complète en lecture seule et contestations du candidat. Aucune
 * de ces données n'est modifiable — un signalement ne rejoue pas l'évaluation.
 * `myReview` est le seul avis exposé : celui de l'admin courant, ou `null`.
 * `canReview` est décidé par le serveur (pas d'auto-review, pas de second avis).
 */
export type AdminCriterionReportDetail = {
  report: AdminCriterionReport;
  candidateUserId: string | null;
  criterion: AdminCriterionContext;
  assessment: RecruiterAssessmentView;
  contests: RecruiterContestationView[];
  averageGap: number | null;
  canReview: boolean;
  myReview: AdminCriterionReportReview | null;
};

/**
 * Chiffres du tableau de bord admin (`GET /api/v1/admin/dashboard`) : toute la plateforme, agrégée côté
 * serveur. Chaque compteur est le total de la liste admin correspondante ; `candidates` / `recruiters`
 * sont des identités cumulables (ne pas les additionner). Aucune moyenne ni tendance — seuls les
 * « nouveaux sur 7 jours » existent.
 */
export type AdminDashboard = {
  accounts: {
    active: number;
    inactive: number;
    suspended: number;
    candidates: number;
    recruiters: number;
    admins: number;
    newLast7Days: number;
  };
  offers: { draft: number; validated: number; published: number; closed: number };
  /** Offres publiées non expirées (le périmètre du job board). */
  liveOffers: number;
  applications: { toReview: number; accepted: number; rejected: number; newLast7Days: number };
  moderation: {
    skillSuggestions: number;
    /** Signalements IA que l'admin courant peut relire (ni auteur, ni déjà relu). */
    reportsAwaitingMyReview: number;
    reportsTotal: number;
  };
  /**
   * Traitements IA définitivement en échec (tentatives épuisées) et encore d'actualité : un échec
   * remplacé par une version postérieure n'est pas compté. Un compte par sujet, lecture seule.
   */
  processingFailures: {
    candidateAnalyses: number;
    offerAnalyses: number;
    embeddings: number;
    screenings: number;
    matchings: number;
  };
};
