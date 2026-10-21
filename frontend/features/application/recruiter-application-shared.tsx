import { appliedOnLabel } from "@/features/application/application-shared";
import type {
  RecruiterAnswerView,
  RecruiterCandidateSummary,
  RecruiterSectionKey,
} from "@/types/application";

/** Libellés des cinq sections du matching côté recruteur (mêmes clés que l'API). */
export const RECRUITER_SECTION_LABELS: Record<RecruiterSectionKey, string> = {
  requiredSkills: "Required skills",
  preferredSkills: "Preferred skills",
  languages: "Languages",
  experience: "Experience",
  education: "Education",
};

/** Nom d'affichage du candidat, sans email ni autre donnée de profil. */
export function recruiterCandidateName(candidate: RecruiterCandidateSummary | null): string {
  if (!candidate) {
    return "Candidate";
  }
  return `${candidate.firstName} ${candidate.lastName}`.trim() || "Candidate";
}

/** Date de transmission lisible ; null si l'ISO est illisible. */
export function submittedOnLabel(iso: string): string | null {
  return appliedOnLabel(iso);
}

/** Valeur texte d'une réponse recruteur, selon son type (options = libellés joints). */
export function recruiterAnswerValue(answer: RecruiterAnswerView): string {
  if (answer.type === "yes_no") {
    return answer.booleanValue === null ? "Not answered" : answer.booleanValue ? "Yes" : "No";
  }
  if (answer.type === "number") {
    return answer.number === null ? "Not answered" : String(answer.number);
  }
  if (answer.type === "single_choice" || answer.type === "multiple_choice") {
    return answer.options.length === 0
      ? "Not answered"
      : answer.options.map((option) => option.label).join(", ");
  }
  return answer.text?.trim() ? answer.text : "Not answered";
}

/** Signal de contestation de la carte : nombre + écart moyen absolu, jamais une note. */
export function contestSummary(count: number, averageGap: number | null): string {
  if (count === 0) {
    return "No contests";
  }
  const contestLabel = count === 1 ? "1 contested" : `${count} contested`;
  if (averageGap === null) {
    return contestLabel;
  }
  const gap = Number.isInteger(averageGap) ? String(averageGap) : averageGap.toFixed(1);
  return `${contestLabel} · avg gap ${gap} pts`;
}
