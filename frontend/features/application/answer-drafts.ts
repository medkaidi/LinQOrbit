import type {
  ApplicationAnswerRequest,
  ApplicationAnswerView,
  ApplicationQuestionView,
} from "@/types/application";

/** Brouillon de réponse, une forme par type de question (seul le slot utile vit). */
export type AnswerDraft = {
  text: string;
  number: string;
  yesNo: "" | "yes" | "no";
  optionIds: string[];
};

export function emptyAnswerDraft(): AnswerDraft {
  return { text: "", number: "", yesNo: "", optionIds: [] };
}

export function emptyAnswerDrafts(
  questions: ApplicationQuestionView[],
): Record<string, AnswerDraft> {
  return Object.fromEntries(questions.map((question) => [question.id, emptyAnswerDraft()]));
}

/** Brouillon d'une réponse enregistrée (reprise d'un brouillon de candidature, D59). */
function draftFromAnswer(answer: ApplicationAnswerView): AnswerDraft {
  const draft = emptyAnswerDraft();
  const { value } = answer;
  if (typeof value === "string") {
    return { ...draft, text: value };
  }
  if (typeof value === "number") {
    return { ...draft, number: String(value) };
  }
  if (typeof value === "boolean") {
    return { ...draft, yesNo: value ? "yes" : "no" };
  }
  if (Array.isArray(value)) {
    return { ...draft, optionIds: value.map((option) => option.optionId) };
  }
  return value ? { ...draft, optionIds: [value.optionId] } : draft;
}

/**
 * Brouillons pré-remplis par les réponses déjà enregistrées ; une question
 * sans réponse (ou une réponse d'une question disparue) reste vide.
 */
export function draftsFromAnswers(
  questions: ApplicationQuestionView[],
  answers: ApplicationAnswerView[],
): Record<string, AnswerDraft> {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  return Object.fromEntries(
    questions.map((question) => {
      const answer = byQuestion.get(question.id);
      return [question.id, answer ? draftFromAnswer(answer) : emptyAnswerDraft()];
    }),
  );
}

/**
 * Valeur numérique stockable — miroir des bornes backend : NUMERIC(12,2)
 * (deux décimales au plus une fois les zéros retirés) et |v| < 10^10.
 * Les décimales se comptent sur `String(value)`, la représentation la plus
 * courte que `JSON.stringify` envoie et que le backend relit en BigDecimal —
 * jamais par `value * 100`, faussé par les flottants (0.29 × 100 =
 * 28.999999999999996). Une forme exponentielle (1e-7) n'a pas deux décimales.
 */
export function isStorableAnswerNumber(value: number): boolean {
  if (!Number.isFinite(value) || Math.abs(value) >= 10_000_000_000) {
    return false;
  }
  const text = String(value);
  if (/e/i.test(text)) {
    return false;
  }
  const fraction = text.split(".")[1] ?? "";
  return fraction.length <= 2;
}

/** Réponse à envoyer pour une question, ou null si laissée vide (ou nombre non stockable). */
export function toAnswerRequest(
  question: ApplicationQuestionView,
  draft: AnswerDraft,
): ApplicationAnswerRequest | null {
  switch (question.type) {
    case "text": {
      const text = draft.text.trim();
      return text === "" ? null : { questionId: question.id, text };
    }
    case "number": {
      const raw = draft.number.trim();
      if (raw === "") {
        return null;
      }
      const value = Number(raw);
      return isStorableAnswerNumber(value) ? { questionId: question.id, number: value } : null;
    }
    case "yes_no":
      return draft.yesNo === ""
        ? null
        : { questionId: question.id, booleanValue: draft.yesNo === "yes" };
    case "single_choice":
    case "multiple_choice":
      return draft.optionIds.length === 0
        ? null
        : { questionId: question.id, optionIds: [...draft.optionIds] };
  }
}

/** Libellés des questions à nombre saisi non stockable (message miroir du backend). */
export function invalidAnswerNumbers(
  questions: ApplicationQuestionView[],
  drafts: Record<string, AnswerDraft>,
): string[] {
  return questions
    .filter((question) => {
      if (question.type !== "number") {
        return false;
      }
      const raw = drafts[question.id]?.number.trim() ?? "";
      return raw !== "" && !isStorableAnswerNumber(Number(raw));
    })
    .map((question) => question.label);
}

/** Libellés des questions obligatoires laissées sans réponse. */
export function unansweredRequired(
  questions: ApplicationQuestionView[],
  drafts: Record<string, AnswerDraft>,
): string[] {
  return questions
    .filter(
      (question) =>
        question.isRequired &&
        toAnswerRequest(question, drafts[question.id] ?? emptyAnswerDraft()) === null,
    )
    .map((question) => question.label);
}

/** Réponses à envoyer, dans l'ordre des questions (les vides sont omises). */
export function buildAnswerRequests(
  questions: ApplicationQuestionView[],
  drafts: Record<string, AnswerDraft>,
): ApplicationAnswerRequest[] {
  return questions
    .map((question) => toAnswerRequest(question, drafts[question.id] ?? emptyAnswerDraft()))
    .filter((answer): answer is ApplicationAnswerRequest => answer !== null);
}
