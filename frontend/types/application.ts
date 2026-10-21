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

/**
 * État de l'évaluation du couple, **calculé par le serveur** (T-62/T-63) :
 * matching courant pour un brouillon, matching rattaché pour une candidature
 * transmise (`matched` false si transmise sans matching). Pilote l'indicateur d'étapes.
 */
export type ApplicationAssessment = {
  matched: boolean;
  /** Le matching existe et l'évaluation n'est pas close : le candidat doit encore agir (analyse, question, clôture). */
  assessmentOpen: boolean;
  assessmentFinished: boolean;
  contested: boolean;
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
  assessment: ApplicationAssessment;
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

/* ------------------------------------------------------------------------- */
/* Vue recruteur (T-66, D65) — types miroirs des DTOs backend, camelCase.     */
/* ------------------------------------------------------------------------- */

/** Statuts visibles côté recruteur : brouillons et retraits n'existent pas dans cette vue. */
export type RecruiterApplicationStatusValue = "submitted" | "accepted" | "rejected";

export type RecruiterApplicationSortValue =
  | "submittedAt"
  | "requiredSkills"
  | "preferredSkills"
  | "languages"
  | "experience"
  | "education"
  | "contests";

export type RecruiterApplicationDirection = "asc" | "desc";

export type RecruiterSectionKey =
  | "requiredSkills"
  | "preferredSkills"
  | "languages"
  | "experience"
  | "education";

export type RecruiterCandidateSummary = {
  firstName: string;
  lastName: string;
};

/** Offre contexte de la vue recruteur (titre, statut et lien public). */
export type RecruiterJobSummary = {
  id: string;
  publicId: string;
  slug: string;
  title: string;
  status: string;
  companyName: string | null;
};

/** Score d'une section ; `null` quand la section manque dans le résultat — jamais 0 par défaut. */
export type RecruiterSectionScore = {
  section: RecruiterSectionKey;
  score: number | null;
};

/** Carte de liste : aucune note globale, seulement les cinq sections et le signal de contestation. */
export type RecruiterApplicationCard = {
  id: string;
  candidate: RecruiterCandidateSummary | null;
  status: RecruiterApplicationStatusValue;
  submittedAt: string;
  assessmentAvailable: boolean;
  sections: RecruiterSectionScore[];
  contestedCount: number;
  averageGap: number | null;
};

export type RecruiterApplicationPage = {
  job: RecruiterJobSummary;
  items: RecruiterApplicationCard[];
  page: number;
  size: number;
  total: number;
};

/** Option choisie dans une réponse recruteur ; `preferred` reste une information recruteur. */
export type RecruiterAnswerOptionView = {
  id: string;
  label: string;
  preferred: boolean;
};

/** Réponse recruteur : valeur typée unique selon `type`, options avec `preferred` pour les choix. */
export type RecruiterAnswerView = {
  questionId: string;
  label: string;
  type: QuestionTypeValue;
  required: boolean;
  text: string | null;
  number: number | null;
  booleanValue: boolean | null;
  options: RecruiterAnswerOptionView[];
};

/** Critère du matching côté recruteur : justification IA par critère, jamais de preuve interne. */
export type RecruiterCriterionView = {
  key: string;
  label: string;
  requirement: string | null;
  weight: number;
  score: number;
  rationale: string;
};

export type RecruiterAssessmentSectionView = {
  section: RecruiterSectionKey;
  score: number | null;
  criteria: RecruiterCriterionView[];
};

/** Évaluation épinglée à la transmission ; `available=false` sans résultat terminé. */
export type RecruiterAssessmentView = {
  available: boolean;
  sections: RecruiterAssessmentSectionView[];
};

export type RecruiterClarificationStatusValue = "open" | "answered" | "skipped";

export type RecruiterClarificationView = {
  id: string;
  question: string;
  rationale: string | null;
  answer: string | null;
  status: RecruiterClarificationStatusValue;
};

/** Contestation candidate d'un critère : signal de désaccord, jamais un score de qualité. */
export type RecruiterContestationView = {
  criterionKey: string;
  label: string;
  aiScore: number;
  selfValue: number;
  gap: number;
  comment: string | null;
};

export type RecruiterCvSummary = {
  attachmentId: string;
  originalName: string;
  sizeBytes: number | null;
};

export type RecruiterApplicationDetail = {
  id: string;
  candidate: RecruiterCandidateSummary | null;
  status: RecruiterApplicationStatusValue;
  submittedAt: string;
  /** Calculé par le serveur : transmise + droit de gestion D12 (owner ou créateur). */
  canDecide: boolean;
  job: RecruiterJobSummary;
  answers: RecruiterAnswerView[];
  assessment: RecruiterAssessmentView;
  clarifications: RecruiterClarificationView[];
  contests: RecruiterContestationView[];
  cv: RecruiterCvSummary | null;
};

export type RecruiterApplicationDecision = "accepted" | "rejected";
