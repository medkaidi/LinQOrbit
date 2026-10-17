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
export type RequirementTypeValue = "mandatory" | "preferred";
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
export type JobOfferQuestionOption = {
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
export type JobOfferQuestion = {
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
  skills: JobOfferSkillOption[];
  languages: JobOfferLanguageOption[];
  degreeIds: string[];
  studyFieldIds: string[];
  questions: JobOfferQuestion[];
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
  /** Gate de complétude calculé serveur (description, pays, type d'emploi, ≥ 1 skill). */
  readyToPublish: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Page d'offres du recruteur (enveloppe backend, page 0-based — D34). */
export type JobOfferPage = {
  items: JobOfferListItem[];
  page: number;
  size: number;
  total: number;
};
