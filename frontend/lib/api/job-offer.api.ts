import { api } from "@/lib/api/axios";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { sanitizeHtml } from "@/lib/utils/sanitize-html";
import type {
  CreateJobOfferValues,
  JobOfferValues,
  UpdateJobOfferValues,
} from "@/lib/validations/job-offer.schemas";
import { isChoiceQuestionType } from "@/lib/validations/job-offer.schemas";
import type {
  JobOffer,
  JobOfferLabelOption,
  JobOfferPage,
} from "@/types/recruiter";

/** Corps envoyé au backend : "" → null, nombres en string → number (miroir profil candidat). */
export type JobOfferPayload = {
  companyId: string;
  title: string;
  description: string | null;
  seniority: string | null;
  requiredExpYear: number | null;
  city: string | null;
  country: string | null;
  contractTypeId: string | null;
  employmentTypeId: string | null;
  workModeId: string | null;
  expiresAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  skills: {
    skillId: string;
    requirementType: string;
    weight: number;
    yearsExperience: number | null;
  }[];
  languages: { languageId: string; level: string; isRequired: boolean }[];
  degreeIds: string[];
  studyFieldIds: string[];
  questions: {
    label: string;
    type: string;
    isRequired: boolean;
    sortOrder: number;
    options: { label: string; preferred: boolean; sortOrder: number }[];
  }[];
};

export type UpdateJobOfferPayload = Omit<JobOfferPayload, "companyId">;

const numberOrNull = (value: string): number | null =>
  value === "" ? null : Number(value);

const textOrNull = (value: string): string | null => (value === "" ? null : value);

/** Description riche : HTML sanitisé, document vide (`<p></p>` ou blanc) → null. */
const htmlOrNull = (value: string): string | null => {
  const clean = sanitizeHtml(value).trim();
  return clean === "" || clean === "<p></p>" ? null : clean;
};

/**
 * Conversion d'un formulaire (toutes chaînes) vers le corps API. Les lignes
 * sans référence choisie sont jetées (le formulaire les autorise tant qu'elles
 * sont vides).
 */
export function toJobOfferPayload(
  values: JobOfferValues,
  companyId: string,
): JobOfferPayload {
  return {
    companyId,
    title: values.title,
    description: htmlOrNull(values.description),
    seniority: textOrNull(values.seniority),
    requiredExpYear: numberOrNull(values.requiredExpYear),
    city: textOrNull(values.city),
    country: textOrNull(values.country),
    contractTypeId: textOrNull(values.contractTypeId),
    employmentTypeId: textOrNull(values.employmentTypeId),
    workModeId: textOrNull(values.workModeId),
    expiresAt: textOrNull(values.expiresAt),
    salaryMin: numberOrNull(values.salaryMin),
    salaryMax: numberOrNull(values.salaryMax),
    salaryCurrency: textOrNull(values.salaryCurrency),
    salaryPeriod: textOrNull(values.salaryPeriod),
    skills: values.skills
      .filter((skill) => skill.skillId !== "")
      .map((skill) => ({
        skillId: skill.skillId,
        requirementType: skill.requirementType,
        weight: Number(skill.weight),
        yearsExperience: numberOrNull(skill.yearsExperience),
      })),
    languages: values.languages
      .filter((language) => language.languageId !== "" && language.level !== "")
      .map((language) => ({
        languageId: language.languageId,
        level: language.level,
        isRequired: language.isRequired,
      })),
    degreeIds: values.degreeIds.filter((id) => id !== ""),
    studyFieldIds: values.studyFieldIds.filter((id) => id !== ""),
    // L'ordre du formulaire EST l'ordre métier ; les options n'existent que
    // sur les types à choix (règle de masquage — jamais envoyées sinon).
    questions: values.questions.map((question, index) => ({
      label: question.label,
      type: question.type,
      isRequired: question.isRequired,
      sortOrder: index,
      options: isChoiceQuestionType(question.type)
        ? question.options.map((option, optionIndex) => ({
            label: option.label,
            preferred: option.preferred,
            sortOrder: optionIndex,
          }))
        : [],
    })),
  };
}

/** La taille de page n'est jamais envoyée : le backend décide (D34). */
export async function listJobOffers(
  params: { page?: number } = {},
  options: { signal?: AbortSignal } = {},
): Promise<JobOfferPage> {
  const response = await api.get<JobOfferPage>("/api/v1/job-offers", {
    params: { ...(params.page !== undefined ? { page: params.page } : {}) },
    signal: options.signal,
  });
  return response.data;
}

export async function getJobOffer(offerId: string): Promise<JobOffer> {
  const response = await api.get<JobOffer>(`/api/v1/job-offers/${offerId}`);
  return response.data;
}

export async function createJobOffer(
  values: CreateJobOfferValues,
): Promise<JobOffer> {
  const { companyId, ...rest } = values;
  const response = await api.post<JobOffer>(
    "/api/v1/job-offers",
    toJobOfferPayload(rest, companyId),
  );
  return response.data;
}

export async function updateJobOffer(
  offerId: string,
  values: UpdateJobOfferValues,
): Promise<void> {
  const { companyId, ...rest } = values;
  await api.put(`/api/v1/job-offers/${offerId}`, toJobOfferPayload(rest, companyId));
}

export async function deleteJobOffer(offerId: string): Promise<void> {
  await api.delete(`/api/v1/job-offers/${offerId}`);
}

export async function validateJobOffer(offerId: string): Promise<void> {
  await api.post(`/api/v1/job-offers/${offerId}/validate`);
}

export async function publishJobOffer(offerId: string): Promise<void> {
  await api.post(`/api/v1/job-offers/${offerId}/publish`);
}

export async function closeJobOffer(offerId: string): Promise<void> {
  await api.post(`/api/v1/job-offers/${offerId}/close`);
}

export async function duplicateJobOffer(offerId: string): Promise<JobOffer> {
  const response = await api.post<JobOffer>(`/api/v1/job-offers/${offerId}/duplicate`);
  return response.data;
}

export async function listContractTypes(): Promise<JobOfferLabelOption[]> {
  const response = await api.get<JobOfferLabelOption[]>(
    "/api/v1/job-offers/reference/contract-types",
  );
  return response.data;
}

export async function listEmploymentTypes(): Promise<JobOfferLabelOption[]> {
  const response = await api.get<JobOfferLabelOption[]>(
    "/api/v1/job-offers/reference/employment-types",
  );
  return response.data;
}

export async function listWorkModes(): Promise<JobOfferLabelOption[]> {
  const response = await api.get<JobOfferLabelOption[]>(
    "/api/v1/job-offers/reference/work-modes",
  );
  return response.data;
}

export function getJobOfferErrorMessage(error: unknown): string {
  return getApiErrorMessage(error);
}
