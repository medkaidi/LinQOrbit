import type { ScreeningSignal } from "@/types/invitation";

/** Profil recruteur (D10) renvoyé par /api/v1/recruiters/me. */
export type RecruiterProfile = {
  id: string;
  headline: string | null;
  bio: string | null;
};

/** Company vue par un membre : `isOwner` porte le rôle coarse (D11–D12). */
export type Company = {
  id: string;
  name: string;
  description: string | null;
  isOwner: boolean;
};

export type JobOfferStatusValue = "draft" | "validated" | "published" | "closed";
export type SeniorityValue = "junior" | "mid" | "senior" | "lead" | "principal";
type RequirementTypeValue = "mandatory" | "preferred";
export type SalaryPeriodValue = "year" | "month" | "day" | "hour";
export type QuestionTypeValue =
  | "text"
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "number";

export type JobOfferSkillOption = {
  skillId: string;
  name: string | null;
  requirementType: RequirementTypeValue;
  weight: number;
  yearsExperience: number | null;
};

export type JobOfferLanguageOption = {
  languageId: string;
  symbol: string | null;
  name: string | null;
  level: string;
  isRequired: boolean;
};

/** Option de question de présélection (D47) — `preferred` reste côté recruteur. */
type JobOfferQuestionOption = {
  id: string;
  label: string;
  sortOrder: number;
  preferred: boolean;
};

/**
 * Question de présélection rattachée à l'offre (D47) — comme les skills et
 * langues, elle ne vit pas dans le snapshot normalisé ni dans les réponses
 * publiques : seules les vues recruteur la portent.
 */
type JobOfferQuestion = {
  id: string;
  label: string;
  type: QuestionTypeValue;
  isRequired: boolean;
  sortOrder: number;
  options: JobOfferQuestionOption[];
};

/** Offre vue par un membre de la company (D12–D13). */
export type JobOffer = {
  id: string;
  companyId: string;
  recruiterId: string;
  status: JobOfferStatusValue;
  title: string;
  publicId: string;
  slug: string;
  description: string | null;
  seniority: SeniorityValue | null;
  requiredExpYear: number | null;
  city: string | null;
  country: string | null;
  contractTypeId: string | null;
  employmentTypeId: string | null;
  workModeId: string | null;
  validatedAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriodValue | null;
  hasUnvalidatedChanges: boolean;
  normalizationInProgress: boolean;
  normalizationFailed: boolean;
  /** Fiche de référence produite sous une version de schéma périmée (D63) : « Validate again ». */
  analysisOutdated: boolean;
  /** Recherche automatique de candidats (T-101, D85) : null tant qu'aucune n'a été demandée. */
  screening: ScreeningSignal | null;
  skills: JobOfferSkillOption[];
  languages: JobOfferLanguageOption[];
  degreeIds: string[];
  studyFieldIds: string[];
  questions: JobOfferQuestion[];
  /** Plafond de questions de clarification IA posées au candidat (0-10, défaut serveur 3). */
  maxClarificationQuestions: number;
  createdAt: string;
  updatedAt: string;
};

/** Option de vocabulaire d'offre (contract_type / employment_type / work_mode, D14). */
export type JobOfferLabelOption = {
  id: string;
  label: string;
};

/**
 * Ligne de la liste des offres (D34) : vue légère — la description et les
 * listes enfants (skills, langues, diplômes, domaines) ne sont servies que
 * par la fiche détail (`JobOffer`).
 */
export type JobOfferListItem = {
  id: string;
  companyId: string;
  status: JobOfferStatusValue;
  title: string;
  publicId: string;
  slug: string;
  seniority: SeniorityValue | null;
  city: string | null;
  country: string | null;
  contractTypeId: string | null;
  employmentTypeId: string | null;
  workModeId: string | null;
  expiresAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriodValue | null;
  hasUnvalidatedChanges: boolean;
  normalizationInProgress: boolean;
  normalizationFailed: boolean;
  /** Fiche de référence produite sous une version de schéma périmée (D63) : « Validate again ». */
  analysisOutdated: boolean;
  /** Recherche automatique de candidats (T-101, D85) : null tant qu'aucune n'a été demandée. */
  screening: ScreeningSignal | null;
  /** Gate de complétude calculé serveur (description, pays, type d'emploi, ≥ 1 skill). */
  readyToPublish: boolean;
  /**
   * Candidatures visibles de l'offre (transmises, acceptées, rejetées —
   * brouillons et retraits exclus), calculé par le serveur.
   */
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Fenêtre d'échéance d'un filtre de la liste (T-70) : « expiringSoon » = dans les 30 jours. */
export type JobOfferExpiryFilter = "expired" | "expiringSoon";

/**
 * Filtres facultatifs de la liste des offres du recruteur (T-70), combinés en
 * ET : une clé absente n'est pas un filtre (jamais de valeur vide envoyée).
 */
export type JobOfferFilters = {
  q?: string;
  status?: JobOfferStatusValue;
  workModeId?: string;
  contractTypeId?: string;
  employmentTypeId?: string;
  seniority?: SeniorityValue;
  companyId?: string;
  expiry?: JobOfferExpiryFilter;
};

/** Page d'offres du recruteur (enveloppe backend, page 0-based — D34). */
export type JobOfferPage = {
  items: JobOfferListItem[];
  page: number;
  size: number;
  total: number;
};

/** Offre à regarder en premier sur le tableau de bord (ligne légère : ni description ni candidats). */
export type DashboardAttentionOffer = {
  id: string;
  title: string;
  status: JobOfferStatusValue;
  expiresAt: string | null;
  /** Candidatures transmises en attente de décision. */
  toReview: number;
  screening: ScreeningSignal | null;
};

/**
 * Chiffres du tableau de bord recruteur, **calculés par le serveur** sur les
 * offres de toutes ses sociétés : offres par statut (une offre publiée expirée
 * reste « published »), offres ouvertes (même périmètre que le job board),
 * échéances dans les 30 jours (même fenêtre que le filtre de la liste),
 * candidatures visibles (ni brouillon ni retrait), candidats à inviter / invités
 * parmi ceux qui ont consenti, recherches en échec et jusqu'à 5 offres à
 * regarder. Jamais de moyenne, de délai d'embauche ni de tendance.
 */
export type RecruiterDashboard = {
  offers: Record<JobOfferStatusValue, number>;
  liveOffers: number;
  closingSoon: { count: number; nextExpiry: string | null };
  applications: { toReview: number; accepted: number; rejected: number };
  candidates: { toInvite: number; invited: number; searchesFailed: number };
  attention: DashboardAttentionOffer[];
};
