import type { ApplicationContext, ApplicationQuestionView, ApplicationResponse } from "@/types/application";
import type { CvAttachment } from "@/types/candidate";

export const CV_ID = "11111111-1111-4111-8111-111111111111";

export function buildCvAttachment(overrides: Partial<CvAttachment> = {}): CvAttachment {
  return {
    id: CV_ID,
    originalName: "ada-lovelace-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 24_576,
    sha256: "a".repeat(64),
    createdAt: "2026-10-01T10:00:00",
    current: true,
    ...overrides,
  };
}

export const TEXT_QUESTION: ApplicationQuestionView = {
  id: "aaaa1111-1111-4111-8111-111111111111",
  label: "Why this role?",
  type: "text",
  isRequired: true,
  sortOrder: 0,
  options: [],
};

export const SINGLE_CHOICE_QUESTION: ApplicationQuestionView = {
  id: "bbbb2222-2222-4222-8222-222222222222",
  label: "Preferred setup?",
  type: "single_choice",
  isRequired: true,
  sortOrder: 1,
  options: [
    { id: "opt-remote", label: "Remote", sortOrder: 0 },
    { id: "opt-hybrid", label: "Hybrid", sortOrder: 1 },
  ],
};

export const MULTIPLE_CHOICE_QUESTION: ApplicationQuestionView = {
  id: "cccc3333-3333-4333-8333-333333333333",
  label: "Your stacks?",
  type: "multiple_choice",
  isRequired: false,
  sortOrder: 2,
  options: [
    { id: "opt-java", label: "Java", sortOrder: 0 },
    { id: "opt-kotlin", label: "Kotlin", sortOrder: 1 },
  ],
};

export const YES_NO_QUESTION: ApplicationQuestionView = {
  id: "dddd4444-4444-4444-8444-444444444444",
  label: "Open to travel?",
  type: "yes_no",
  isRequired: false,
  sortOrder: 3,
  options: [],
};

export const NUMBER_QUESTION: ApplicationQuestionView = {
  id: "eeee5555-5555-4555-8555-555555555555",
  label: "Years of experience?",
  type: "number",
  isRequired: false,
  sortOrder: 4,
  options: [],
};

export function buildApplicationContext(
  overrides: Partial<ApplicationContext> = {},
): ApplicationContext {
  return {
    job: {
      publicId: "abcdefghijkl",
      slug: "backend-engineer",
      title: "Backend Engineer",
      companyName: "Nimbus Labs",
    },
    questions: [TEXT_QUESTION, SINGLE_CHOICE_QUESTION],
    currentCvAttachmentId: CV_ID,
    existingApplication: null,
    answers: [],
    step: "recruiter_questions",
    canSubmit: false,
    assessment: { matched: false, assessmentOpen: false, assessmentFinished: false, contested: false },
    ...overrides,
  };
}

export function buildApplication(
  overrides: Partial<ApplicationResponse> = {},
): ApplicationResponse {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    status: "submitted",
    createdAt: "2026-10-10T09:30:00",
    updatedAt: "2026-10-10T09:30:00",
    job: {
      publicId: "abcdefghijkl",
      slug: "backend-engineer",
      title: "Backend Engineer",
      companyName: "Nimbus Labs",
    },
    cv: { attachmentId: CV_ID, originalName: "ada-lovelace-cv.pdf" },
    answers: [
      {
        questionId: TEXT_QUESTION.id,
        label: TEXT_QUESTION.label,
        type: "text",
        value: "I love APIs",
      },
      {
        questionId: SINGLE_CHOICE_QUESTION.id,
        label: SINGLE_CHOICE_QUESTION.label,
        type: "single_choice",
        value: { optionId: "opt-remote", label: "Remote" },
      },
    ],
    ...overrides,
  };
}
