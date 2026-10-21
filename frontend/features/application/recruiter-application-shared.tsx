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

/** Bande de lecture d'un score : vert ≥ 70, orange 40–69, gris < 40, absent. */
export type ScoreBand = "strong" | "partial" | "weak" | "none";

/** Seuils fixes, valeur bornée à 0–100 ; la couleur ne remplace jamais le chiffre. */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null || Number.isNaN(score)) {
    return "none";
  }
  const bounded = Math.max(0, Math.min(100, score));
  if (bounded >= 70) {
    return "strong";
  }
  return bounded >= 40 ? "partial" : "weak";
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

/** Nombre de critères contestés, au singulier/pluriel et sans zéro affiché comme un score. */
export function contestCountLabel(count: number): string {
  if (count === 0) {
    return "No contests";
  }
  return count === 1 ? "1 contested" : `${count} contested`;
}

/** Écart moyen absolu formaté (entier ou une décimale) ; null quand il n'existe pas. */
export function averageGapValue(averageGap: number | null): string | null {
  if (averageGap === null) {
    return null;
  }
  return Number.isInteger(averageGap) ? String(averageGap) : averageGap.toFixed(1);
}

/** Résumé accessible du panneau de contestations : nombre + écart moyen, jamais une note. */
export function contestSummary(count: number, averageGap: number | null): string {
  const contestLabel = contestCountLabel(count);
  const gap = averageGapValue(averageGap);
  if (count === 0 || gap === null) {
    return contestLabel;
  }
  return `${contestLabel} · avg gap ${gap} pts`;
}
