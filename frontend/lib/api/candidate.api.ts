import { api } from "@/lib/api/axios";
import { saveBlob } from "@/lib/utils/download";
import type {
  AboutValues,
  DiplomasValues,
  ExperiencesValues,
  LanguagesValues,
  LinksValues,
  ProjectsValues,
  SkillsValues,
} from "@/lib/validations/candidate.schemas";
import type {
  CandidateProfile,
  CvAttachment,
  LanguageReference,
  LabelReference,
  ParsedCv,
  SkillReference,
} from "@/types/candidate";

const BASE = "/api/v1/candidates";

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

/**
 * Valide explicitement le profil : crée (ou relance) le job de normalisation
 * côté backend. Seul déclencheur de l'analyse IA.
 */
export async function validateProfile(): Promise<void> {
  await api.post(`${BASE}/me/profile/validate`);
}

export async function updateAbout(values: AboutValues): Promise<void> {
  await api.put(`${BASE}/me/profile/about`, {
    title: values.title,
    bio: values.bio === "" ? null : values.bio,
    yearsOfExperience: values.yearsOfExperience,
    searchStatus: values.searchStatus,
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

export async function updateProjects(values: ProjectsValues): Promise<void> {
  await api.put(
    `${BASE}/me/profile/projects`,
    values.items.map((item) => ({
      name: item.name,
      role: item.role === "" ? null : item.role,
      description: item.description === "" ? null : item.description,
      startDate: item.startDate,
      endDate: item.endDate === "" ? null : item.endDate,
      technologies: item.technologies === "" ? null : item.technologies,
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

/** Compétences absentes du catalogue, envoyées en revue manuelle. */
export async function suggestSkills(names: string[]): Promise<void> {
  await api.post(`${BASE}/me/profile/skill-suggestions`, { names });
}

const ATTACHMENTS_BASE = `${BASE}/me/attachments`;

/** CV déposés du candidat, du plus récent au plus ancien (backend). */
export async function listCvs(): Promise<CvAttachment[]> {
  const response = await api.get<CvAttachment[]>(ATTACHMENTS_BASE);
  return response.data;
}

/** Dépose un CV (PDF) : le nouveau dépôt devient le CV courant. */
export async function uploadCv(file: File): Promise<CvAttachment> {
  const body = new FormData();
  body.append("file", file);
  const response = await api.post<CvAttachment>(ATTACHMENTS_BASE, body);
  return response.data;
}

/** Désigne le CV courant (celui que les candidatures joindront). */
export async function setCurrentCv(attachmentId: string): Promise<void> {
  await api.put(`${ATTACHMENTS_BASE}/${attachmentId}/current`);
}

export async function deleteCv(attachmentId: string): Promise<void> {
  await api.delete(`${ATTACHMENTS_BASE}/${attachmentId}`);
}

/** Télécharge le contenu (blob) et déclenche l'enregistrement navigateur. */
export async function downloadCv(attachmentId: string, fileName: string): Promise<void> {
  const response = await api.get<Blob>(`${ATTACHMENTS_BASE}/${attachmentId}/content`, {
    responseType: "blob",
  });
  saveBlob(response.data, fileName);
}
