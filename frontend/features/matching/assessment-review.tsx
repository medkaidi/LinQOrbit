"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import {
  useController,
  useForm,
  type Control,
  type UseFormResetField,
} from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import { IndexBadge } from "@/components/ui/index-badge";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { MATCHING_SECTION_LABELS } from "@/features/matching/matching-shared";
import { ScoreEditor } from "@/features/matching/score-editor";
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
  control,
  resetField,
}: {
  criterion: MatchingCriterion;
  index: number;
  control: Control<AssessmentFeedbackValues>;
  resetField: UseFormResetField<AssessmentFeedbackValues>;
}) {
  const scoreField = useController({ control, name: `items.${index}.selfValue` });
  const commentField = useController({ control, name: `items.${index}.comment` });
  const [editing, setEditing] = useState(
    () => scoreField.field.value !== "" || commentField.field.value !== "",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const value = scoreField.field.value;
  const comment = commentField.field.value;
  const hasValue = value !== "";

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Vider le score efface aussi le commentaire : le schéma interdit un commentaire sans score.
  const changeScore = (next: string) => {
    scoreField.field.onChange(next);
    if (next === "") {
      commentField.field.onChange("");
    }
  };

  const removeScore = () => {
    if (hasValue) {
      // « Clear score » retire la contestation : elle ne sera supprimée qu'au Save.
      scoreField.field.onChange("");
      commentField.field.onChange("");
    } else {
      // « Cancel » sur un éditeur vide restaure la dernière valeur sauvée (ou vide).
      resetField(`items.${index}.selfValue`);
      resetField(`items.${index}.comment`);
    }
    setEditing(false);
  };

  return (
    <li className={`${ITEM_CARD_CLASS} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="text-body-md font-body-md font-semibold text-text-primary min-w-0 break-words">
          {criterion.label}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge tone="outline">AI {criterion.score}%</Badge>
          {hasValue ? <Badge tone="accent">You {value}%</Badge> : null}
          {!editing ? (
            <Button
              variant="outline-sm"
              type="button"
              aria-label={`${hasValue ? "Edit" : "Add"} your score for ${criterion.label}`}
              onClick={startEditing}
            >
              <Icon name={hasValue ? "edit" : "add"} className="text-[16px]" />
              {hasValue ? "Edit your score" : "Add your score"}
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <ScoreEditor
            label={criterion.label}
            aiScore={criterion.score}
            value={value}
            name={scoreField.field.name}
            error={scoreField.fieldState.error?.message}
            onChange={changeScore}
            onBlur={scoreField.field.onBlur}
            onRemove={removeScore}
            inputRef={inputRef}
          />
          {hasValue ? (
            <Textarea
              label="Comment (optional)"
              aria-label={`Comment on ${criterion.label}`}
              maxLength={FEEDBACK_COMMENT_MAX}
              name={commentField.field.name}
              value={comment}
              onChange={(event) => commentField.field.onChange(event.target.value)}
              onBlur={commentField.field.onBlur}
              error={commentField.fieldState.error?.message}
              labelAction={
                <span className={MUTED_TEXT_CLASS}>
                  {comment.length} / {FEEDBACK_COMMENT_MAX}
                </span>
              }
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AssessmentReviewForm({
  publicId,
  matching,
  onDirtyChange,
}: {
  publicId: string;
  matching: Matching;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const save = useSaveMatchingFeedback(publicId);
  const [resetVersion, setResetVersion] = useState(0);
  const {
    control,
    handleSubmit,
    reset,
    resetField,
    formState: { isDirty },
  } = useForm<AssessmentFeedbackValues>({
    resolver: zodResolver(assessmentFeedbackSchema),
    defaultValues: toFormValues(matching),
  });

  // Le garde-fou de transmission lit cet état : Submit reste désactivé tant que la revue est dirty.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Indices des lignes = ordre aplati des critères (celui de `toFormValues`).
  const offsets = matching.sections.map((_, sectionIndex) =>
    matching.sections.slice(0, sectionIndex).reduce((total, previous) => total + previous.criteria.length, 0),
  );
  const groups = matching.sections.map((section, sectionIndex) => ({
    section,
    sectionIndex,
    rows: section.criteria.map((criterion, criterionIndex) => ({
      criterion,
      index: offsets[sectionIndex] + criterionIndex,
    })),
  }));

  const onSubmit = (values: AssessmentFeedbackValues) =>
    save.mutate(values, {
      onSuccess: () => {
        reset(values);
        // Remonte les lignes : un critère vidé redevient compact, les autres repartent de la valeur sauvée.
        setResetVersion((version) => version + 1);
      },
    });

  const handleDiscard = () => {
    save.reset();
    reset();
    setResetVersion((version) => version + 1);
  };

  const status = save.isPending
    ? "Saving your view…"
    : isDirty
      ? "Unsaved changes"
      : save.isSuccess
        ? "Your view is saved"
        : "No unsaved changes";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 pt-5 pb-6 flex flex-col gap-6">
      <p className={`${MUTED_TEXT_CLASS} max-w-3xl`}>
        Tell the recruiter where you see a criterion differently. Add your own score from 0 to 100,
        with an optional comment. Your view is shown next to the AI score and never changes it. Leave
        a score empty to show only the AI score.
      </p>

      {groups.map(({ section, sectionIndex, rows }) => (
        <section
          key={section.section}
          aria-label={`Your view on ${MATCHING_SECTION_LABELS[section.section]}`}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <IndexBadge>{sectionIndex + 1}</IndexBadge>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-text-primary min-w-0 break-words">
                {MATCHING_SECTION_LABELS[section.section]}
              </h3>
            </div>
            <span className={MUTED_TEXT_CLASS}>
              {section.criteria.length} {section.criteria.length === 1 ? "criterion" : "criteria"}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {rows.map(({ criterion, index }) => (
              <CriterionReview
                key={`${criterion.key}-${resetVersion}`}
                criterion={criterion}
                index={index}
                control={control}
                resetField={resetField}
              />
            ))}
          </ul>
        </section>
      ))}

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

      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl sm:rounded-full border border-slate-border bg-canvas-white/95 backdrop-blur-md shadow-lg p-2.5 sm:pl-6">
        <p className="font-label-md text-label-md text-text-secondary" aria-live="polite">
          {status}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline-sm"
            type="button"
            disabled={!isDirty || save.isPending}
            onClick={handleDiscard}
          >
            Discard changes
          </Button>
          <CtaButton type="submit" tone="secondary" icon="save" busy={save.isPending} disabled={!isDirty}>
            Save your view
          </CtaButton>
        </div>
      </div>
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
export function AssessmentReview({
  publicId,
  onDirtyChange,
}: {
  publicId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
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
        <Badge tone="outline">Optional</Badge>
      </header>
      {/* Un nouveau résultat = un formulaire neuf (valeurs par défaut relues). */}
      <AssessmentReviewForm
        key={data.matchingId}
        publicId={publicId}
        matching={data}
        onDirtyChange={onDirtyChange}
      />
    </section>
  );
}
