/**
 * Types TS miroirs des objets canoniques normalisés — candidat schema v3
 * (`ai-service/app/schemas/normalize.py`) et offre schema v2
 * (`ai-service/app/schemas/job_offer.py`). Le backend les transporte en
 * pass-through (`JsonNode` dans `AdminNormalizedProfileResponse`) : le schéma
 * appartient au service IA, jamais restructuré côté Spring.
 *
 * Tous les champs sont optionnels : le contenu est produit par un LLM, la
 * console admin doit tolérer tout champ absent ou null sans planter.
 */

export type Seniority = "junior" | "mid" | "senior" | "lead" | "principal";

export type SkillCategory =
  | "programming_language"
  | "framework"
  | "library"
  | "tool"
  | "methodology"
  | "business_domain"
  | "soft_skill"
  | "technical_skill"
  | "regulatory_knowledge"
  | "other";

type ProjectContext =
  | "personal"
  | "academic"
  | "open_source"
  | "professional"
  | "volunteer"
  | "other";

type SkillOrigin = "declared" | "inferred";

type LevelSource = "declared" | "inferred";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type OfferContractType =
  | "permanent"
  | "fixed_term"
  | "freelance"
  | "internship"
  | "apprenticeship"
  | "volunteer";

type WorkTime = "full_time" | "part_time";

type WorkMode = "remote" | "hybrid" | "on_site";

type ResponsibilityImportance = "mandatory" | "optional";

/** Localisation pass-through (compte ou offre), jamais inventée. */
type NormalizedLocation = {
  city?: string | null;
  country?: string | null;
};

/** Index capacités (candidat v3) : preuve pointer sur une section de la même fiche. */
type SkillEvidence = {
  source?: "bio" | "experience" | "project" | "diploma" | "certification";
  /** Index 0-based dans le tableau de sortie de cette section — jamais un id ; null pour bio. */
  index?: number | null;
};

type NormalizedSkill = {
  name?: string;
  category?: SkillCategory;
  /** Niveau 1–5, null quand non déclaré ni fortement inféré. */
  level?: number | null;
  levelSource?: LevelSource | null;
  yearsExperience?: number | null;
  origin?: SkillOrigin;
  evidence?: SkillEvidence[];
};

export type NormalizedExperience = {
  positionTitle?: string;
  companyName?: string;
  companyCountry?: string | null;
  /** Mois de début, YYYY-MM. */
  startDate?: string;
  /** YYYY-MM, null = poste en cours. */
  endDate?: string | null;
  description?: string | null;
  domain?: string | null;
  responsibilities?: string[];
  technologies?: string[];
  achievements?: string[];
};

export type NormalizedProject = {
  name?: string;
  role?: string | null;
  description?: string | null;
  startDate?: string;
  endDate?: string | null;
  context?: ProjectContext;
  domain?: string | null;
  responsibilities?: string[];
  technologies?: string[];
  achievements?: string[];
};

export type NormalizedDiploma = {
  title?: string;
  institution?: string;
  institutionCountry?: string | null;
  degreeLabel?: string | null;
  studyFieldLabel?: string | null;
  startDate?: string;
  endDate?: string | null;
  origin?: SkillOrigin;
  evidence?: SkillEvidence[];
};

type NormalizedLanguage = {
  name?: string;
  level?: CefrLevel | null;
  origin?: SkillOrigin;
  evidence?: SkillEvidence[];
};

type NormalizedCertification = {
  name?: string;
  issuer?: string | null;
  issuedAt?: string | null;
  url?: string | null;
  origin?: SkillOrigin;
  evidence?: SkillEvidence[];
};

type NormalizedLink = {
  label?: string;
  url?: string;
};

/** Objet canonique candidat v3 (camelCase sur le wire). */
export type NormalizedCandidateProfile = {
  schemaVersion?: string;
  title?: string | null;
  summary?: string | null;
  yearsOfExperience?: number | null;
  seniority?: Seniority | null;
  targetRole?: string | null;
  searchStatus?: string | null;
  location?: NormalizedLocation | null;
  experiences?: NormalizedExperience[];
  projects?: NormalizedProject[];
  diplomas?: NormalizedDiploma[];
  languages?: NormalizedLanguage[];
  certifications?: NormalizedCertification[];
  links?: NormalizedLink[];
  skills?: NormalizedSkill[];
};

/** Offre v2 : preuve pointer sur les responsibilities de la même fiche. */
type OfferSkillEvidence = {
  source?: "responsibility";
  index?: number;
};

export type OfferSkillRequirement = {
  name?: string;
  category?: SkillCategory;
  /** Importance du skill pour le poste, 1-5 (déclaré verbatim, sinon inféré). */
  weight?: number;
  level?: number | null;
  levelSource?: LevelSource | null;
  minYears?: number | null;
  minYearsSource?: LevelSource | null;
  origin?: SkillOrigin;
  evidence?: OfferSkillEvidence[];
};

type OfferLanguageRequirement = {
  name?: string;
  level?: CefrLevel | null;
  required?: boolean;
  origin?: SkillOrigin;
};

export type NormalizedResponsibility = {
  text?: string;
  importance?: ResponsibilityImportance;
  /** Centralité du devoir pour le poste, 1-5 (toujours miné). */
  weight?: number;
  domain?: string | null;
  technologies?: string[];
};

/** Exigence éducation offre v2 : label canonique + provenance obligatoire. */
export type OfferRequirementEntry = {
  label?: string;
  source?: SkillOrigin;
};

/** Certification nommée explicitement par l'offre (jamais inventée). */
type OfferCertification = {
  name?: string;
  issuer?: string | null;
  issuedAt?: string | null;
  url?: string | null;
};

export type NormalizedSalary = {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: string | null;
};

/** Objet canonique offre v2 (camelCase sur le wire). */
export type NormalizedJobOffer = {
  schemaVersion?: string;
  title?: string | null;
  alternateTitles?: string[];
  domain?: string | null;
  contractType?: OfferContractType | null;
  workTime?: WorkTime | null;
  seniority?: Seniority | null;
  workMode?: WorkMode | null;
  location?: NormalizedLocation | null;
  salary?: NormalizedSalary | null;
  /** Expérience totale exigée : déclarée jamais écrasée, minée = advisory. */
  requiredYears?: number | null;
  requiredYearsSource?: LevelSource | null;
  requiredDegrees?: OfferRequirementEntry[];
  requiredStudyFields?: OfferRequirementEntry[];
  languages?: OfferLanguageRequirement[];
  summary?: string | null;
  companyPitch?: string | null;
  description?: string | null;
  responsibilities?: NormalizedResponsibility[];
  requiredSkills?: OfferSkillRequirement[];
  preferredSkills?: OfferSkillRequirement[];
  certifications?: OfferCertification[];
  benefits?: string[];
};
