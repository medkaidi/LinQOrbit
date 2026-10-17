import type { QuestionTypeValue } from "@/types/recruiter";

/** Statut d'une candidature (miroir de l'enum backend `ApplicationStatus`, D49). */
export type ApplicationStatusValue = "submitted" | "withdrawn" | "accepted" | "rejected";

/** Résumé d'offre porté par une candidature — pointe vers `/jobs/{publicId}-{slug}`. */
export type ApplicationJobSummary = {
  publicId: string;
  slug: string;
  title: string;
  companyName: string | null;
};

/** CV épinglé par la candidature (`originalName` null si le fichier a disparu). */
export type ApplicationCvSummary = {
  attachmentId: string;
  originalName: string | null;
};

/** Option cochée dans une réponse (jamais `preferred` — information recruteur seule). */
export type ApplicationAnswerOptionView = {
  optionId: string;
  label: string;
};

/**
 * Réponse reconstruite dans l'ordre des questions de l'offre : `value` suit le
 * type (`text` → string, `number` → number, `yes_no` → boolean,
 * `single_choice` → option unique, `multiple_choice` → liste d'options).
 */
export type ApplicationAnswerView = {
  questionId: string;
  label: string;
  type: QuestionTypeValue;
  value: string | number | boolean | ApplicationAnswerOptionView | ApplicationAnswerOptionView[];
};

export type ApplicationResponse = {
  id: string;
  status: ApplicationStatusValue;
  createdAt: string;
  updatedAt: string;
  job: ApplicationJobSummary;
  cv: ApplicationCvSummary;
  answers: ApplicationAnswerView[];
};

export type ApplicationQuestionOptionView = {
  id: string;
  label: string;
  sortOrder: number;
};

export type ApplicationQuestionView = {
  id: string;
  label: string;
  type: QuestionTypeValue;
  isRequired: boolean;
  sortOrder: number;
  options: ApplicationQuestionOptionView[];
};

/** Candidature existante du couple (candidat, offre) — signalée dans le contexte du formulaire. */
export type ApplicationSummary = {
  id: string;
  status: ApplicationStatusValue;
  createdAt: string;
};

/** Contexte de candidature d'une offre publiée (pré-remplissage du formulaire). */
export type ApplicationContext = {
  job: ApplicationJobSummary;
  questions: ApplicationQuestionView[];
  currentCvAttachmentId: string | null;
  existingApplication: ApplicationSummary | null;
};

/** Corps de `POST /api/v1/applications` : une seule forme de réponse selon le type de question. */
export type ApplicationAnswerRequest = {
  questionId: string;
  text?: string;
  number?: number;
  booleanValue?: boolean;
  optionIds?: string[];
};

export type SubmitApplicationRequest = {
  jobPublicId: string;
  /** Absent ≡ CV courant du candidat (résolu côté backend). */
  cvAttachmentId?: string;
  answers: ApplicationAnswerRequest[];
};
