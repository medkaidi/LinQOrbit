import { appliedOnLabel } from "@/features/application/application-shared";
import { cn } from "@/lib/utils/cn";
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

/**
 * Score affiché : borné à 0–100 puis arrondi. La couleur suit **la valeur
 * affichée** (un « 70 » n'est jamais orange) — la barre suit la même valeur.
 */
export function displayScore(score: number | null): number | null {
  if (score === null || Number.isNaN(score)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Code de lecture d'un score, source unique carte ↔ détail : couleur du texte
 * et surface de la pastille. La barre reste toujours bleue.
 */
export const SCORE_BAND_CLASSES: Record<ScoreBand, { text: string; surface: string }> = {
  strong: { text: "text-success-text", surface: "bg-success-surface" },
  partial: { text: "text-orange-deep", surface: "bg-orange-subtle" },
  weak: { text: "text-slate-muted", surface: "bg-slate-surface" },
  none: { text: "text-text-tertiary", surface: "bg-slate-surface" },
};

/** Tailles de la valeur : classes complètes par variante (jamais de surcharge). */
const SCORE_VALUE_SIZE_CLASSES = {
  sm: { value: "text-[11px] font-bold", unit: "text-[9px] font-semibold text-text-tertiary" },
  md: { value: "text-body-md font-bold", unit: "text-[11px] font-semibold text-text-tertiary" },
} as const;

export type ScoreValueSize = keyof typeof SCORE_VALUE_SIZE_CLASSES;

/** Unité « % » — source unique (toujours neutre, jamais colorée). */
export const SCORE_UNIT_CLASSES: Record<ScoreValueSize, string> = {
  sm: SCORE_VALUE_SIZE_CLASSES.sm.unit,
  md: SCORE_VALUE_SIZE_CLASSES.md.unit,
};

/**
 * Valeur d'un score en pourcentage : le chiffre porte la couleur de sa bande,
 * l'unité « % » reste neutre. Rend `null` sans score (absent ≠ 0).
 */
export function ScorePercentValue({
  score,
  size = "sm",
}: {
  score: number | null;
  size?: ScoreValueSize;
}) {
  if (score === null) {
    return null;
  }
  const band = scoreBand(score);
  const classes = SCORE_VALUE_SIZE_CLASSES[size];
  return (
    <span className={cn("inline-flex items-baseline gap-0.5 tabular-nums", SCORE_BAND_CLASSES[band].text)}>
      <span className={classes.value}>{score}</span>
      <span className={classes.unit}>%</span>
    </span>
  );
}

/**
 * Pastille de score (agrégat de section) : fond teinté par bande, valeur
 * colorée, unité neutre.
 */
export function ScorePercentChip({
  score,
  size = "md",
}: {
  score: number | null;
  size?: ScoreValueSize;
}) {
  if (score === null) {
    return null;
  }
  const band = scoreBand(score);
  const classes = SCORE_VALUE_SIZE_CLASSES[size];
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 rounded-full px-2.5 py-1 tabular-nums",
        SCORE_BAND_CLASSES[band].surface,
        SCORE_BAND_CLASSES[band].text,
      )}
    >
      <span className={classes.value}>{score}</span>
      <span className={classes.unit}>%</span>
    </span>
  );
}

/** Monogramme du candidat (photo à venir) — même forme que la carte de liste. */
export function candidateInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
