import type {
  RecruiterApplicationCard,
  RecruiterApplicationDetail,
  RecruiterApplicationPage,
} from "@/types/application";

export const RECRUITER_OFFER_ID = "11111111-1111-4111-8111-111111111111";
export const RECRUITER_APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
export const RECRUITER_CV_ID = "33333333-3333-4333-8333-333333333333";

const JOB = {
  id: RECRUITER_OFFER_ID,
  publicId: "abcdefghijkl",
  slug: "backend-engineer",
  title: "Backend Engineer",
  status: "published",
  companyName: "Acme Labs",
};

const SECTIONS = [
  { section: "requiredSkills" as const, score: 60 },
  { section: "preferredSkills" as const, score: 75 },
  { section: "languages" as const, score: 80 },
  { section: "experience" as const, score: 85 },
  { section: "education" as const, score: 90 },
];

export function buildRecruiterApplicationCard(
  overrides: Partial<RecruiterApplicationCard> = {},
): RecruiterApplicationCard {
  return {
    id: RECRUITER_APPLICATION_ID,
    candidate: { firstName: "Grace", lastName: "Hopper", title: "Senior Backend Engineer" },
    status: "submitted",
    submittedAt: "2026-10-15T09:30:00",
    assessmentAvailable: true,
    sections: SECTIONS,
    contestedCount: 2,
    averageGap: 20,
    ...overrides,
  };
}

export function buildRecruiterApplicationPage(
  overrides: Partial<RecruiterApplicationPage> = {},
): RecruiterApplicationPage {
  return {
    job: JOB,
    items: [buildRecruiterApplicationCard()],
    page: 0,
    size: 20,
    total: 1,
    ...overrides,
  };
}

export function buildRecruiterApplicationDetail(
  overrides: Partial<RecruiterApplicationDetail> = {},
): RecruiterApplicationDetail {
  return {
    id: RECRUITER_APPLICATION_ID,
    candidate: { firstName: "Grace", lastName: "Hopper", title: "Senior Backend Engineer" },
    status: "submitted",
    submittedAt: "2026-10-15T09:30:00",
    canDecide: true,
    job: JOB,
    answers: [
      {
        questionId: "question-text",
        label: "Why this role?",
        type: "text",
        required: true,
        text: "I love APIs",
        number: null,
        booleanValue: null,
        options: [],
      },
      {
        questionId: "question-single",
        label: "Preferred setup?",
        type: "single_choice",
        required: true,
        text: null,
        number: null,
        booleanValue: null,
        options: [{ id: "option-on-site", label: "On site", preferred: true }],
      },
      {
        questionId: "question-multiple",
        label: "Your stacks?",
        type: "multiple_choice",
        required: false,
        text: null,
        number: null,
        booleanValue: null,
        options: [
          { id: "option-java", label: "Java", preferred: true },
          { id: "option-python", label: "Python", preferred: false },
        ],
      },
    ],
    assessment: {
      available: true,
      sections: [
        {
          section: "requiredSkills",
          score: 60,
          criteria: [
            {
              key: "skill:java",
              label: "Java",
              requirement: "Strong Java",
              weight: 4,
              score: 55,
              rationale: "Solid Java experience, but the depth is partial.",
            },
          ],
        },
        {
          section: "preferredSkills",
          score: 75,
          criteria: [],
        },
        {
          section: "languages",
          score: 80,
          criteria: [],
        },
        {
          section: "experience",
          score: 85,
          criteria: [],
        },
        {
          section: "education",
          score: 90,
          criteria: [],
        },
      ],
    },
    clarifications: [
      {
        id: "clarification-1",
        question: "Why did you choose Java?",
        rationale: "To refine the skill assessment.",
        answer: "Because I use it daily.",
        status: "answered",
      },
    ],
    contests: [
      {
        criterionKey: "language:english",
        label: "English",
        aiScore: 80,
        selfValue: 70,
        gap: 10,
        comment: "I write English docs every day.",
      },
      {
        criterionKey: "skill:java",
        label: "Java",
        aiScore: 60,
        selfValue: 90,
        gap: 30,
        comment: null,
      },
    ],
    averageGap: 20,
    criterionReports: [],
    cv: {
      attachmentId: RECRUITER_CV_ID,
      originalName: "grace-hopper-cv.pdf",
      sizeBytes: 24576,
    },
    ...overrides,
  };
}
