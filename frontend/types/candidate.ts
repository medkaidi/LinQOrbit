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
  diplomas: DiplomaItem[];
  skills: SkillItem[];
  languages: LanguageItem[];
  links: LinkItem[];
  completionPercentage: number;
};

/** Listes de référence (skills, languages, degrees, study-fields). */
export type SkillReference = {
  id: string;
  name: string;
  skillType: string;
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
export type ParsedCvExperience = {
  positionTitle: string;
  companyName: string;
  companyCountry: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export type ParsedCvDiploma = {
  title: string;
  institution: string;
  institutionCountry: string | null;
  degreeLabel: string | null;
  studyFieldLabel: string | null;
  startDate: string;
  endDate: string | null;
};

export type ParsedCvSkill = {
  name: string;
  level: number | null;
  yearsExperience: number | null;
};

export type ParsedCvLanguage = {
  name: string;
  level: string | null;
};

export type ParsedCvLink = {
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
