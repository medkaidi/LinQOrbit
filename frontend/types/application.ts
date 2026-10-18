import type { QuestionTypeValue } from "@/types/recruiter";

/** Statut d'une candidature (miroir de l'enum backend `ApplicationStatus`, D49 révisé par D59). */
export type ApplicationStatusValue = "draft" | "submitted" | "withdrawn" | "accepted" | "rejected";

/**
 * Étape du parcours de candidature, **calculée par le serveur** (D59) — le
 * frontend ne la déduit jamais lui-même.
 */
export type ApplicationStep = "recruiter_questions" | "matching" | "submitted";

/** Résumé d'offre porté par une candidature — pointe vers `/jobs/{publicId}-{slug}`. */
export type ApplicationJobSummary = {
  publicId: string;
  slug: string;
  title: string;
  companyName: string | null;
};

/** CV de la candidature (`originalName` null si le fichier a disparu) — épinglé à la transmission. */
type ApplicationCvSummary = {
  attachmentId: string;
  originalName: string | null;
};

/** Option cochée dans une réponse (jamais `preferred` — information recruteur seule). */
type ApplicationAnswerOptionView = {
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
  /** Null pour un brouillon sans CV (le CV est exigé à la transmission). */
  cv: ApplicationCvSummary | null;
  answers: ApplicationAnswerView[];
};

type ApplicationQuestionOptionView = {
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

/** Candidature du couple (candidat, offre), brouillon compris — signalée dans le contexte du parcours. */
export type ApplicationSummary = {
  id: string;
  status: ApplicationStatusValue;
  /** CV renseigné (null pour un brouillon sans CV). */
  cvAttachmentId: string | null;
  createdAt: string;
};

/** Contexte du parcours de candidature d'une offre publiée (D59). */
export type ApplicationContext = {
  job: ApplicationJobSummary;
  questions: ApplicationQuestionView[];
  currentCvAttachmentId: string | null;
  existingApplication: ApplicationSummary | null;
  /** Réponses enregistrées de la candidature du couple (vide sans candidature). */
  answers: ApplicationAnswerView[];
  step: ApplicationStep;
  /** Brouillon dont toutes les questions obligatoires sont répondues. */
  canSubmit: boolean;
};

/** Réponse envoyée avec le brouillon : une seule forme selon le type de question. */
export type ApplicationAnswerRequest = {
  questionId: string;
  text?: string;
  number?: number;
  booleanValue?: boolean;
  optionIds?: string[];
};

/** Corps de `PUT /api/v1/applications/draft` : crée le brouillon ou remplace ses réponses (partiel permis). */
export type SaveApplicationDraftRequest = {
  jobPublicId: string;
  answers: ApplicationAnswerRequest[];
};

/** Corps de `POST /api/v1/applications/{id}/submit` : CV absent ≡ CV du brouillon, sinon courant. */
export type SubmitApplicationRequest = {
  cvAttachmentId?: string;
};
