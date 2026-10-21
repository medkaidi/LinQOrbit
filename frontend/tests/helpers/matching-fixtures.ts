import type { Matching, MatchingClarification } from "@/types/matching";

/** Matching courant minimal : analyse en attente, aucune question, évaluation ouverte, aucune contestation. */
export function buildMatching(overrides: Partial<Matching> = {}): Matching {
  return {
    matchingId: "m-1",
    status: "pending",
    sections: [],
    assessmentFinished: false,
    clarification: null,
    feedback: [],
    ...overrides,
  };
}

export function buildClarification(overrides: Partial<MatchingClarification> = {}): MatchingClarification {
  return {
    id: "c1c1c1c1-1111-4111-8111-111111111111",
    question: "Have you used Kubernetes in production?",
    rationale: "Your profile does not mention Kubernetes, which this offer requires.",
    questionNumber: 1,
    remainingQuestions: 2,
    ...overrides,
  };
}
