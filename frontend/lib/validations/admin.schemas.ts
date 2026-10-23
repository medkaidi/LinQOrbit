import { z } from "zod";

/** Bornes de la revue interne (T-96), miroirs du backend. */
export const CRITERION_REPORT_REVIEW_NOTE_MAX = 2000;
export const CRITERION_REPORT_REVIEW_RATIONALE_MAX = 2000;

export const CRITERION_REPORT_REVIEW_VERDICTS = ["upheld", "notUpheld"] as const;

/**
 * Formulaire de revue interne : tous les champs facultatifs restent des
 * `string` ("" = vide, conversion en null dans la couche feature/API — règle
 * z.input = z.output du resolver). Le verdict est obligatoire ; une chaîne
 * vide est refusée pour forcer un choix explicite.
 */
const verdictOrEmpty = z
  .enum(["", ...CRITERION_REPORT_REVIEW_VERDICTS], "Choose a verdict")
  .refine((value): boolean => value !== "", "Choose a verdict");

const correctedScoreOrEmpty = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^(100|[1-9]?[0-9])$/.test(value),
    "Enter a whole number between 0 and 100",
  );

export const criterionReportReviewSchema = z.object({
  verdict: verdictOrEmpty,
  note: z
    .string()
    .trim()
    .max(
      CRITERION_REPORT_REVIEW_NOTE_MAX,
      `Note must be ${CRITERION_REPORT_REVIEW_NOTE_MAX} characters or fewer`,
    ),
  correctedScore: correctedScoreOrEmpty,
  correctedRationale: z
    .string()
    .trim()
    .max(
      CRITERION_REPORT_REVIEW_RATIONALE_MAX,
      `Corrected rationale must be ${CRITERION_REPORT_REVIEW_RATIONALE_MAX} characters or fewer`,
    ),
});

export type CriterionReportReviewValues = z.infer<typeof criterionReportReviewSchema>;
