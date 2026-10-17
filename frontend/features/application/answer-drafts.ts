import type { ApplicationAnswerRequest, ApplicationQuestionView } from "@/types/application";

/** Brouillon de réponse, une forme par type de question (seul le slot utile vit). */
export type AnswerDraft = {
  text: string;
  number: string;
  yesNo: "" | "yes" | "no";
  optionIds: string[];
};

function emptyAnswerDraft(): AnswerDraft {
  return { text: "", number: "", yesNo: "", optionIds: [] };
}

export function emptyAnswerDrafts(
  questions: ApplicationQuestionView[],
): Record<string, AnswerDraft> {
  return Object.fromEntries(questions.map((question) => [question.id, emptyAnswerDraft()]));
}

/**
 * Valeur numérique stockable — miroir des bornes backend : NUMERIC(12,2)
 * (deux décimales au plus une fois les zéros retirés) et |v| < 10^10.
 */
export function isStorableAnswerNumber(value: number): boolean {
  return (
    Number.isFinite(value) && Math.abs(value) < 10_000_000_000 && Number.isInteger(value * 100)
  );
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
