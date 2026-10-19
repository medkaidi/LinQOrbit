"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import { MATCHING_SECTION_LABELS } from "@/features/matching/matching-shared";
import { useCurrentMatching, useSaveMatchingFeedback } from "@/hooks/use-matching";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  assessmentFeedbackSchema,
  FEEDBACK_COMMENT_MAX,
  type AssessmentFeedbackValues,
} from "@/lib/validations/matching.schemas";
import type { Matching, MatchingCriterion } from "@/types/matching";

/** Une ligne par critère, dans l'ordre des sections ; pré-remplie par les contestations enregistrées. */
function toFormValues(matching: Matching): AssessmentFeedbackValues {
  const saved = new Map(matching.feedback.map((item) => [item.criterionKey, item]));
  return {
    items: matching.sections.flatMap((section) =>
      section.criteria.map((criterion) => {
        const item = saved.get(criterion.key);
        return {
          criterionKey: criterion.key,
          selfValue: item ? String(item.selfValue) : "",
          comment: item?.comment ?? "",
        };
      }),
    ),
  };
}

function CriterionReview({
  criterion,
  index,
  register,
  errors,
}: {
  criterion: MatchingCriterion;
  index: number;
  register: UseFormRegister<AssessmentFeedbackValues>;
  errors: FieldErrors<AssessmentFeedbackValues>;
}) {
  const rowErrors = errors.items?.[index];
  return (
    <li className={`${ITEM_CARD_CLASS} flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm font-body-sm font-semibold text-text-primary min-w-0 break-words">
          {criterion.label}
        </span>
        <span className={`${MUTED_TEXT_CLASS} shrink-0`}>
          AI score <span className="font-mono text-text-primary">{criterion.score}%</span>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-3 items-start">
        <TextField
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          label="Your score"
          aria-label={`Your score for ${criterion.label}`}
          placeholder="0–100"
          error={rowErrors?.selfValue?.message}
          {...register(`items.${index}.selfValue`)}
        />
        <Textarea
          label="Comment (optional)"
          aria-label={`Comment on ${criterion.label}`}
          maxLength={FEEDBACK_COMMENT_MAX}
          error={rowErrors?.comment?.message}
          {...register(`items.${index}.comment`)}
        />
      </div>
    </li>
  );
}

function AssessmentReviewForm({ publicId, matching }: { publicId: string; matching: Matching }) {
  const save = useSaveMatchingFeedback(publicId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AssessmentFeedbackValues>({
    resolver: zodResolver(assessmentFeedbackSchema),
    defaultValues: toFormValues(matching),
  });

  // Indices des lignes = ordre aplati des critères (celui de `toFormValues`).
  const offsets = matching.sections.map((_, sectionIndex) =>
    matching.sections.slice(0, sectionIndex).reduce((total, previous) => total + previous.criteria.length, 0),
  );
  const groups = matching.sections.map((section, sectionIndex) => ({
    section,
    rows: section.criteria.map((criterion, criterionIndex) => ({
      criterion,
      index: offsets[sectionIndex] + criterionIndex,
    })),
  }));

  const onSubmit = (values: AssessmentFeedbackValues) =>
    save.mutate(values, { onSuccess: () => reset(values) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 pt-5 pb-6 flex flex-col gap-6">
      <p className={MUTED_TEXT_CLASS}>
        Do you see a criterion differently? Give your own score from 0 to 100, with an optional
        comment. Leave a score empty to keep only the AI score — your view never changes it.
      </p>

      {groups.map(({ section, rows }) => (
        <section
          key={section.section}
          aria-label={`Your view on ${MATCHING_SECTION_LABELS[section.section]}`}
          className="flex flex-col gap-3"
        >
          <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
            {MATCHING_SECTION_LABELS[section.section]}
          </h3>
          <ul className="flex flex-col gap-3">
            {rows.map(({ criterion, index }) => (
              <CriterionReview
                key={criterion.key}
                criterion={criterion}
                index={index}
                register={register}
                errors={errors}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <CtaButton type="submit" icon="save" busy={save.isPending} disabled={!isDirty}>
          Save
        </CtaButton>
      </div>

      {save.error ? (
        <Alert variant="error" title="Could not save your assessment">
          {getApiErrorMessage(save.error)}
        </Alert>
      ) : null}
      {save.isSuccess && !isDirty ? (
        <Alert variant="success" title="Assessment saved">
          Your view on each criterion is saved with your application.
        </Alert>
      ) : null}
    </form>
  );
}

/**
 * Revue candidat (T-63), une fois l'évaluation close et avant transmission :
 * pour chaque critère, le score de l'IA et le score du candidat (0–100, entier)
 * avec un commentaire facultatif ; un seul « Save » envoie la liste complète
 * (le PUT remplace tout — un score vidé retire la contestation). Ni poids, ni
 * score de section, ni moyenne, ni justification.
 */
export function AssessmentReview({ publicId }: { publicId: string }) {
  const matching = useCurrentMatching(publicId);
  const data = matching.data;
  if (!data || data.status !== "done" || !data.assessmentFinished || data.sections.length === 0) {
    return null;
  }
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Your assessment">
      <header className={SECTION_HEADER_CLASS}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBadge icon="rate_review" />
          <h2 className={SECTION_TITLE_CLASS}>Your assessment</h2>
        </div>
      </header>
      {/* Un nouveau résultat = un formulaire neuf (valeurs par défaut relues). */}
      <AssessmentReviewForm key={data.matchingId} publicId={publicId} matching={data} />
    </section>
  );
}
