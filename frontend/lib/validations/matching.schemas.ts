import { z } from "zod";

/** Bornes de la contestation (T-63), miroirs du backend. */
export const FEEDBACK_COMMENT_MAX = 2000;
/** Réponse à une clarification IA (T-62) : 1–3000 caractères après trim, miroir du backend. */
export const CLARIFICATION_ANSWER_MAX = 3000;

const SELF_VALUE_MESSAGE = "Enter a whole number between 0 and 100";

/**
 * Ligne de la revue candidat : tout reste en `string` (règle z.input = z.output
 * du resolver) — `selfValue` `""` = critère non contesté (omis de l'envoi, donc
 * supprimé côté serveur), conversion en nombre dans la couche API.
 */
const feedbackRowSchema = z.object({
  criterionKey: z.string(),
  selfValue: z.union([z.string().regex(/^(100|[1-9]?[0-9])$/, SELF_VALUE_MESSAGE), z.literal("")], SELF_VALUE_MESSAGE),
  comment: z
    .string()
    .trim()
    .max(FEEDBACK_COMMENT_MAX, `Comment must be ${FEEDBACK_COMMENT_MAX} characters or fewer`),
});

export const assessmentFeedbackSchema = z
  .object({ items: z.array(feedbackRowSchema) })
  .superRefine((values, ctx) => {
    // Un commentaire sans score serait perdu à l'envoi (le serveur exige un score par item).
    values.items.forEach((row, index) => {
      if (row.selfValue === "" && row.comment !== "") {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "selfValue"],
          message: "Enter your score to keep this comment",
        });
      }
    });
  });

export type AssessmentFeedbackValues = z.infer<typeof assessmentFeedbackSchema>;
