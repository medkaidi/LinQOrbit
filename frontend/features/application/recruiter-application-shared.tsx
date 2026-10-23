import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  MUTED_TEXT_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { appliedOnLabel } from "@/features/application/application-shared";
import { cn } from "@/lib/utils/cn";
import type {
  CriterionReportReason,
  RecruiterAnswerView,
  RecruiterCandidateSummary,
  RecruiterSectionKey,
} from "@/types/application";

/** En-tête de carte du détail recruteur : icône, titre et méta facultative. */
export function SectionHeader({
  title,
  icon,
  aside,
}: {
  title: string;
  icon: string;
  aside?: string;
}) {
  return (
    <header className={SECTION_HEADER_CLASS}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBadge icon={icon} />
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      </div>
      {aside ? <span className={MUTED_TEXT_CLASS}>{aside}</span> : null}
    </header>
  );
}

/** Libellés des cinq sections du matching côté recruteur (mêmes clés que l'API). */
export const RECRUITER_SECTION_LABELS: Record<RecruiterSectionKey, string> = {
  requiredSkills: "Required skills",
  preferredSkills: "Preferred skills",
  languages: "Languages",
  experience: "Experience",
  education: "Education",
};

/**
 * Libellé d'une section venue du serveur (console admin) : la section inconnue
 * est rendue telle quelle plutôt que masquée.
 */
export function recruiterSectionLabel(section: string | null): string | null {
  if (!section) {
    return null;
  }
  return RECRUITER_SECTION_LABELS[section as RecruiterSectionKey] ?? section;
}

/** Motifs d'un signalement interne d'une évaluation IA (D66) — libellés et ordre d'affichage. */
export const CRITERION_REASON_LABELS: Record<CriterionReportReason, string> = {
  scoreIncorrect: "The score is wrong",
  evidenceWrong: "The evidence is wrong",
  profileMisunderstood: "The profile was misunderstood",
  requirementMisunderstood: "The requirement was misunderstood",
  other: "Other",
};

/** Options du sélecteur de motif (valeurs API). */
export const CRITERION_REASON_OPTIONS: { value: CriterionReportReason; label: string }[] = (
  Object.keys(CRITERION_REASON_LABELS) as CriterionReportReason[]
).map((value) => ({ value, label: CRITERION_REASON_LABELS[value] }));

/**
 * Aide de saisie par motif : le commentaire est facultatif partout, mais le
 * motif « other » ne dit rien par lui-même — le commentaire y est obligatoire.
 */
export const CRITERION_REASON_PLACEHOLDERS: Record<CriterionReportReason, string> = {
  scoreIncorrect: "Which score is off, and what should it be?",
  evidenceWrong: "Which piece of evidence is wrong?",
  profileMisunderstood: "What did the AI misread in the profile?",
  requirementMisunderstood: "Which requirement was misread?",
  other: "What should the internal team know?",
};

/** Le motif « other » porte l'information dans le commentaire : il l'exige. */
export function criterionReasonRequiresComment(reason: CriterionReportReason): boolean {
  return reason === "other";
}

/** Nom d'affichage du candidat, sans email ni autre donnée de profil. */
export function recruiterCandidateName(candidate: RecruiterCandidateSummary | null): string {
  if (!candidate) {
    return "Candidate";
  }
  return `${candidate.firstName} ${candidate.lastName}`.trim() || "Candidate";
}

/** Écart affiché : entier tel quel, sinon une décimale (valeur serveur). */
export function gapLabel(gap: number): string {
  return Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
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

/** Densités du bloc « Average gap » : `sm` sur la carte, `md` sur le détail. */
const CONTEST_GAP_SIZE_CLASSES = {
  sm: {
    container: "rounded-lg border border-orange-border/60 bg-canvas-white/80 px-2 py-1",
    label: "flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-text-tertiary",
    icon: "text-[12px] text-orange-deep/70",
    value: "text-sm font-bold text-orange-deep tabular-nums",
  },
  md: {
    container: "rounded-2xl border border-orange-border/60 bg-canvas-white/80 px-3 py-2",
    label: "flex items-center gap-1.5 font-label-md text-label-md font-bold text-text-secondary",
    icon: "text-[14px] text-orange-deep/70",
    value: "text-body-md font-body-md font-bold text-orange-deep tabular-nums",
  },
} as const;

export type ContestGapSize = keyof typeof CONTEST_GAP_SIZE_CLASSES;

/**
 * Bloc « Average gap » — source unique carte ↔ détail : même libellé, même
 * code couleur, deux densités. L'écart moyen vient du serveur.
 */
export function ContestGapBlock({
  averageGap,
  size = "sm",
}: {
  averageGap: number | null;
  size?: ContestGapSize;
}) {
  const gap = averageGapValue(averageGap);
  const classes = CONTEST_GAP_SIZE_CLASSES[size];
  return (
    <div className={classes.container}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={classes.label}>
          <Icon name="compare_arrows" className={classes.icon} />
          Average gap
        </span>
        <span className={classes.value}>
          {gap === null ? "Not available" : `${gap} pts`}
        </span>
      </div>
    </div>
  );
}
