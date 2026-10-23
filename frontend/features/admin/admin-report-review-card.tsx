"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import {
  MUTED_TEXT_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCriterionReportReview } from "@/hooks/use-admin";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatShortDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  CRITERION_REPORT_REVIEW_NOTE_MAX,
  CRITERION_REPORT_REVIEW_RATIONALE_MAX,
  criterionReportReviewSchema,
  type CriterionReportReviewValues,
} from "@/lib/validations/admin.schemas";
import type {
  AdminCriterionReportReview,
  AdminCriterionReportReviewPayload,
  AdminCriterionReportReviewVerdict,
} from "@/types/admin";

const MUTED = MUTED_TEXT_CLASS;
const FIELD_LABEL = "font-label-caps text-label-caps uppercase text-text-tertiary";
/** Carte unique du dossier : arrondi de fiche, plus fermé que les cartes de section. */
const DETAIL_CARD_CLASS = "bg-canvas-white rounded-lg shadow-sm";

/**
 * Carte du dossier de signalement : même surface que les autres cartes admin,
 * en-tête local qui accepte plusieurs méta à droite (section, badge). Les cartes
 * 3 et 4 gardent le `Card` partagé, inchangé.
 */
export function DetailCard({
  title,
  aside,
  children
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={DETAIL_CARD_CLASS}>
      <header className="mx-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-border pt-4 pb-4">
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="flex flex-col gap-5 px-6 pt-5 pb-6">{children}</div>
    </section>
  );
}

const REVIEW_VERDICT_LABELS: Record<AdminCriterionReportReviewVerdict, string> = {
  upheld: "Upheld",
  notUpheld: "Not upheld"
};

const EMPTY_REVIEW_VALUES: CriterionReportReviewValues = {
  verdict: "",
  note: "",
  correctedScore: "",
  correctedRationale: ""
};

/** Conversion formulaire → corps API : les corrections masquées ne partent jamais. */
function toReviewPayload(
  values: CriterionReportReviewValues
): AdminCriterionReportReviewPayload {
  const upheld = values.verdict === "upheld";
  return {
    verdict: values.verdict as AdminCriterionReportReviewVerdict,
    note: values.note ? values.note : null,
    correctedScore:
      upheld && values.correctedScore ? Number(values.correctedScore) : null,
    correctedRationale:
      upheld && values.correctedRationale ? values.correctedRationale : null
  };
}

function ReviewVerdict({
  verdict
}: {
  verdict: AdminCriterionReportReviewVerdict;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={verdict === "upheld" ? "success" : "neutral"}>
        {REVIEW_VERDICT_LABELS[verdict]}
      </Badge>
      <span className={MUTED}>
        {verdict === "upheld"
          ? "The report is valid; the AI score may be corrected."
          : "The report is not upheld; the AI score is maintained."}
      </span>
    </div>
  );
}

function ReviewSummaryItem({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-border bg-item-surface/50 p-4",
        className
      )}
    >
      <dt className={FIELD_LABEL}>{label}</dt>
      <dd className="mt-1 text-body-sm font-body-sm text-text-primary break-words whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  );
}

/** Avis déjà enregistré : le sien uniquement, définitif et non éditable. */
function ReadOnlyReview({ review }: { review: AdminCriterionReportReview }) {
  const upheld = review.verdict === "upheld";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReviewVerdict verdict={review.verdict} />
        <span className={`${MUTED} inline-flex items-center gap-1`}>
          <Icon name="event" className="text-[14px]" />
          Submitted {formatShortDate(review.createdAt)}
        </span>
      </div>
      <p className={MUTED}>
        Your review is final and cannot be edited. It does not change the
        report, the AI score or the recruiter&apos;s decision.
      </p>
      <dl className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ReviewSummaryItem label="Note">
          {review.note ? (
            review.note
          ) : (
            <span className={MUTED}>No note.</span>
          )}
        </ReviewSummaryItem>
        {upheld ? (
          <>
            <ReviewSummaryItem label="Corrected score">
              {review.correctedScore === null ? (
                <span className={MUTED}>Not provided.</span>
              ) : (
                `${review.correctedScore}%`
              )}
            </ReviewSummaryItem>
            <ReviewSummaryItem
              label="Corrected rationale"
              className="lg:col-span-2"
            >
              {review.correctedRationale ? (
                review.correctedRationale
              ) : (
                <span className={MUTED}>Not provided.</span>
              )}
            </ReviewSummaryItem>
          </>
        ) : null}
      </dl>
    </div>
  );
}

/**
 * Formulaire de revue : verdict explicite, note libre, corrections seulement
 * pour `upheld`. La soumission ouvre une confirmation récapitulative ; rien
 * n'est envoyé avant elle.
 */
function InternalReviewForm({
  onContinue
}: {
  onContinue: (values: CriterionReportReviewValues) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<CriterionReportReviewValues>({
    resolver: zodResolver(criterionReportReviewSchema),
    defaultValues: EMPTY_REVIEW_VALUES
  });
  const verdict = useWatch({ control, name: "verdict" });
  const note = useWatch({ control, name: "note" }) ?? "";
  const rationale = useWatch({ control, name: "correctedRationale" }) ?? "";

  return (
    <form
      onSubmit={handleSubmit(onContinue)}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className={MUTED}>
        Your review is blind and final. Only you can see it; it never changes
        the report, the AI score or the recruiter&apos;s decision.
      </p>

      <Controller
        control={control}
        name="verdict"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Verdict</span>
            <SegmentedControl
              label="Verdict"
              value={field.value}
              options={[
                { value: "upheld", label: "Upheld" },
                { value: "notUpheld", label: "Not upheld" }
              ]}
              className="self-start"
              onChange={(value) => {
                field.onChange(value);
                if (value !== "upheld") {
                  setValue("correctedScore", "", { shouldDirty: true });
                  setValue("correctedRationale", "", { shouldDirty: true });
                }
              }}
            />
            <p className={MUTED}>
              Upheld means the report is valid and the AI score may be
              corrected. Not upheld keeps the AI score.
            </p>
            {fieldState.error ? (
              <p className="font-body-sm text-body-sm text-error">
                {fieldState.error.message}
              </p>
            ) : null}
          </div>
        )}
      />

      <Textarea
        label="Note (optional)"
        placeholder="Explain your verdict for the record."
        maxLength={CRITERION_REPORT_REVIEW_NOTE_MAX}
        labelAction={
          <span className={MUTED}>
            {note.length} / {CRITERION_REPORT_REVIEW_NOTE_MAX}
          </span>
        }
        error={errors.note?.message}
        {...register("note")}
      />

      {verdict === "upheld" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TextField
            label="Corrected score (optional)"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            placeholder="0-100"
            error={errors.correctedScore?.message}
            {...register("correctedScore")}
          />
          <div className="lg:col-span-2">
            <Textarea
              label="Corrected rationale (optional)"
              placeholder="What should the corrected rationale say?"
              maxLength={CRITERION_REPORT_REVIEW_RATIONALE_MAX}
              labelAction={
                <span className={MUTED}>
                  {rationale.length} / {CRITERION_REPORT_REVIEW_RATIONALE_MAX}
                </span>
              }
              error={errors.correctedRationale?.message}
              {...register("correctedRationale")}
            />
          </div>
          <p className={`${MUTED} lg:col-span-2`}>
            Corrections are optional. Add both fields to make this review
            training-ready.
          </p>
        </div>
      ) : null}

      <div className="flex justify-end border-t border-slate-border pt-4">
        <CtaButton type="submit" icon="fact_check">
          Review and submit
        </CtaButton>
      </div>
    </form>
  );
}

/** Confirmation finale : récapitule exactement ce qui partira au serveur. */
function ReviewConfirmationDialog({
  values,
  busy,
  error,
  onConfirm,
  onCancel
}: {
  values: CriterionReportReviewValues;
  busy: boolean;
  error: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const payload = toReviewPayload(values);
  const upheld = payload.verdict === "upheld";

  return (
    <Dialog
      title="Confirm your review"
      description="This is your final, blind review."
      dismissable={!busy}
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="outline-sm"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <CtaButton type="button" icon="check" busy={busy} onClick={onConfirm}>
            Submit review
          </CtaButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ReviewVerdict verdict={payload.verdict} />
        <dl className="grid grid-cols-1 gap-3">
          <ReviewSummaryItem label="Note">
            {payload.note ?? <span className={MUTED}>No note.</span>}
          </ReviewSummaryItem>
          {upheld ? (
            <>
              <ReviewSummaryItem label="Corrected score">
                {payload.correctedScore === null ? (
                  <span className={MUTED}>Not provided.</span>
                ) : (
                  `${payload.correctedScore}%`
                )}
              </ReviewSummaryItem>
              <ReviewSummaryItem label="Corrected rationale">
                {payload.correctedRationale ?? (
                  <span className={MUTED}>Not provided.</span>
                )}
              </ReviewSummaryItem>
            </>
          ) : null}
        </dl>
        <p className={MUTED}>
          Final, cannot be edited. This review does not change the report, the
          AI score or the recruiter&apos;s decision.
        </p>
        {error ? (
          <Alert variant="error" title="Could not submit your review">
            {getApiErrorMessage(error)}
          </Alert>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Revue interne (T-97) : sans avis, le formulaire et sa confirmation ; avec
 * un avis, uniquement le sien en lecture seule. Jamais de compteur ni d'avis
 * d'un autre administrateur. `canReview` vient du serveur : un admin ne peut
 * jamais relire son propre signalement, et le formulaire n'est pas affiché
 * pour lui — l'UI explique pourquoi au lieu de laisser un bouton voué au 409.
 */
export function InternalReviewCard({
  reportId,
  canReview,
  myReview
}: {
  reportId: string;
  canReview: boolean;
  myReview: AdminCriterionReportReview | null;
}) {
  const mutation = useCreateCriterionReportReview(reportId);
  const [confirmation, setConfirmation] =
    useState<CriterionReportReviewValues | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const closeConfirmation = () => {
    if (mutation.isPending) return;
    mutation.reset();
    setConfirmation(null);
    setSubmitError(null);
  };

  const confirm = () => {
    if (!confirmation) return;
    setSubmitError(null);
    mutation.mutate(toReviewPayload(confirmation), {
      onSuccess: () => {
        setConfirmation(null);
        setSubmitError(null);
      },
      onError: (error) => setSubmitError(error)
    });
  };

  return (
    <>
      <DetailCard
        title="Internal review"
        aside={myReview ? <Badge tone="outline">Final</Badge> : undefined}
      >
        {submitError && canReview && !myReview ? (
          <Alert variant="error" title="Could not submit your review">
            {getApiErrorMessage(submitError)}
          </Alert>
        ) : null}
        {myReview ? (
          <ReadOnlyReview review={myReview} />
        ) : !canReview ? (
          <Alert
            variant="info"
            title="Independent review required"
            className="mt-0"
          >
            You reported this criterion. Another administrator must review it;
            self-review is not allowed.
          </Alert>
        ) : (
          <InternalReviewForm onContinue={setConfirmation} />
        )}
      </DetailCard>
      {canReview && !myReview && confirmation ? (
        <ReviewConfirmationDialog
          values={confirmation}
          busy={mutation.isPending}
          error={submitError}
          onConfirm={confirm}
          onCancel={closeConfirmation}
        />
      ) : null}
    </>
  );
}
