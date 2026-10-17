/** Profil candidat renvoyé par GET /api/v1/candidates/me/profile. */
export type AboutSection = {
  title: string | null;
  targetPosition: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  searchStatus: string | null;
};

export type ExperienceItem = {
  id: string;
  positionTitle: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  companyName: string;
  companyCountry: string | null;
};

export type ProjectItem = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  /** Liste libre séparée par des virgules (saisie utilisateur, pas de canonicalisation). */
  technologies: string | null;
};

export type DiplomaItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  institution: string;
  institutionCountry: string | null;
  degreeId: string | null;
  degreeLabel: string | null;
  studyFieldId: string | null;
  studyFieldLabel: string | null;
};

export type SkillItem = {
  skillId: string;
  name: string;
  skillType: string;
  level: number;
  yearsExperience: number | null;
};

export type LanguageItem = {
  languageId: string;
  symbol: string;
  name: string;
  level: string;
};

export type LinkItem = {
  id: string;
  label: string;
  url: string;
  linkType: string;
  issuer: string | null;
  issuedAt: string | null;
};

export type CandidateProfile = {
  about: AboutSection;
  experiences: ExperienceItem[];
  projects: ProjectItem[];
  diplomas: DiplomaItem[];
  skills: SkillItem[];
  languages: LanguageItem[];
  links: LinkItem[];
  completionPercentage: number;
  /** True tant que le profil a changé depuis la dernière normalisation validée. */
  hasUnvalidatedChanges: boolean;
  /** True si la dernière tentative de validation a échoué définitivement (3 essais). */
  normalizationFailed: boolean;
  /** True si le job de normalisation le plus récent est en attente ou en cours d'exécution. */
  normalizationInProgress: boolean;
};

/** Pièce jointe du candidat (CV) renvoyée par /api/v1/candidates/me/attachments. */
export type CvAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  /** True sur le CV désigné comme courant (un seul à la fois). */
  current: boolean;
};

/** Listes de référence (skills, languages, degrees, study-fields). */
export type SkillReference = {
  id: string;
  name: string;
  skillType: string;
  category: string;
};

export type LanguageReference = {
  id: string;
  symbol: string;
  name: string;
};

export type LabelReference = {
  id: string;
  label: string;
};

/** Résultat de l'analyse d'un CV (POST …/me/profile/cv) : aperçu, rien d'enregistré. */
type ParsedCvExperience = {
  positionTitle: string;
  companyName: string;
  companyCountry: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

type ParsedCvDiploma = {
  title: string;
  institution: string;
  institutionCountry: string | null;
  degreeLabel: string | null;
  studyFieldLabel: string | null;
  startDate: string;
  endDate: string | null;
};

type ParsedCvSkill = {
  name: string;
  level: number | null;
  yearsExperience: number | null;
};

type ParsedCvLanguage = {
  name: string;
  level: string | null;
};

type ParsedCvLink = {
  label: string;
  url: string;
};

export type ParsedCv = {
  title: string | null;
  summary: string | null;
  experiences: ParsedCvExperience[];
  diplomas: ParsedCvDiploma[];
  skills: ParsedCvSkill[];
  languages: ParsedCvLanguage[];
  links: ParsedCvLink[];
};
