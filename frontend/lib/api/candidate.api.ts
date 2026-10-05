import { api } from "@/lib/api/axios";
import type {
  AboutValues,
  DiplomasValues,
  ExperiencesValues,
  LanguagesValues,
  LinksValues,
  SkillsValues,
} from "@/lib/validations/candidate.schemas";

const BASE = "/api/v1/candidates";

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

export async function getProfile(): Promise<CandidateProfile> {
  const response = await api.get<CandidateProfile>(`${BASE}/me/profile`);
  return response.data;
}

/**
 * Envoie le PDF au backend, qui le relaie au service IA. Rien n'est enregistré :
 * le résultat est prévisualisé puis appliqué au formulaire.
 */
export async function parseCv(file: File): Promise<ParsedCv> {
  const body = new FormData();
  body.append("file", file);
  const response = await api.post<ParsedCv>(`${BASE}/me/profile/cv`, body);
  return response.data;
}

export async function updateAbout(values: AboutValues): Promise<void> {
  await api.put(`${BASE}/me/profile/about`, {
    title: values.title,
    bio: values.bio === "" ? null : values.bio,
    yearsOfExperience: values.yearsOfExperience,
    searchStatus: values.searchStatus,
  });
}

/**
 * Poste recherché : champ isolé de la carte identité — le PUT /about ne
 * l'écrit jamais. "" = efface le poste recherché (null côté API).
 */
export async function updateTargetPosition(targetPosition: string): Promise<void> {
  await api.put(`${BASE}/me/profile/about/target-position`, {
    targetPosition: targetPosition === "" ? null : targetPosition,
  });
}

export async function updateExperiences(values: ExperiencesValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/experiences`,
    values.items.map((item) => ({
      positionTitle: item.positionTitle,
      description: item.description === "" ? null : item.description,
      startDate: item.startDate,
      endDate: item.endDate === "" ? null : item.endDate,
      companyName: item.companyName,
      companyCountry: item.companyCountry === "" ? null : item.companyCountry,
    })),
  );
}

export async function updateDiplomas(values: DiplomasValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/diplomas`,
    values.items.map((item) => ({
      title: item.title,
      institution: item.institution,
      institutionCountry: item.institutionCountry === "" ? null : item.institutionCountry,
      degreeId: item.degreeId === "" ? null : item.degreeId,
      studyFieldId: item.studyFieldId === "" ? null : item.studyFieldId,
      startDate: item.startDate,
      endDate: item.endDate === "" ? null : item.endDate,
    })),
  );
}

export async function updateSkills(values: SkillsValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/skills`,
    values.items.map((item) => ({
      skillId: item.skillId,
      level: item.level,
      yearsExperience: item.yearsExperience === "" ? null : Number(item.yearsExperience),
    })),
  );
}

export async function updateLanguages(values: LanguagesValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/languages`,
    values.items.map((item) => ({
      languageId: item.languageId,
      level: item.level,
    })),
  );
}

export async function updateLinks(values: LinksValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/links`,
    values.items.map((item) => ({
      label: item.label,
      url: item.url,
      linkType: item.linkType,
      // issuer et issuedAt n'existent que pour une certification.
      issuer: item.linkType === "certification" && item.issuer !== "" ? item.issuer : null,
      issuedAt: item.linkType === "certification" && item.issuedAt !== "" ? item.issuedAt : null,
    })),
  );
}

export async function getReferenceSkills(): Promise<SkillReference[]> {
  const response = await api.get<SkillReference[]>(`${BASE}/reference/skills`);
  return response.data;
}

export async function getReferenceLanguages(): Promise<LanguageReference[]> {
  const response = await api.get<LanguageReference[]>(`${BASE}/reference/languages`);
  return response.data;
}

export async function getReferenceDegrees(): Promise<LabelReference[]> {
  const response = await api.get<LabelReference[]>(`${BASE}/reference/degrees`);
  return response.data;
}

export async function getReferenceStudyFields(): Promise<LabelReference[]> {
  const response = await api.get<LabelReference[]>(`${BASE}/reference/study-fields`);
  return response.data;
}
