"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IndexBadge } from "@/components/ui/index-badge";
import { NavPill } from "@/components/ui/nav-pill";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS
} from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import {
  CriterionReasonChip,
  CriterionSectionLabel,
  reportFullName
} from "@/features/admin/criterion-report-shared";
import { RetryButton } from "@/features/admin/retry-button";
import {
  candidateInitials,
  contestSummary,
  ContestGapBlock,
  displayScore,
  gapLabel,
  RECRUITER_SECTION_LABELS,
  ScorePercentChip,
  ScorePercentValue,
  SCORE_UNIT_CLASSES
} from "@/features/application/recruiter-application-shared";
import {
  useAdminCriterionReport,
  useCreateCriterionReportReview
} from "@/hooks/use-admin";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatShortDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  CRITERION_REPORT_REVIEW_NOTE_MAX,
  CRITERION_REPORT_REVIEW_RATIONALE_MAX,
  criterionReportReviewSchema,
  type CriterionReportReviewValues
} from "@/lib/validations/admin.schemas";
import type {
  AdminCriterionReport,
  AdminCriterionReportDetail,
  AdminCriterionReportReview,
  AdminCriterionReportReviewPayload,
  AdminCriterionReportReviewVerdict
} from "@/types/admin";
import type {
  RecruiterAssessmentSectionView,
  RecruiterAssessmentView,
  RecruiterContestationView,
  RecruiterCriterionView
} from "@/types/application";

const MUTED = MUTED_TEXT_CLASS;
const FIELD_LABEL =
  "font-label-caps text-label-caps uppercase text-text-tertiary";
const SCORE_LABEL = "font-label-caps text-label-caps uppercase text-blue-deep";
const SCORE_ROW_LABEL =
  "font-label-md text-label-md text-text-secondary";
/** Carte unique du dossier : arrondi de fiche, plus fermé que les cartes de section. */
const DETAIL_CARD_CLASS = "bg-canvas-white rounded-lg shadow-sm";
const DETAIL_TILE_SURFACE =
  "rounded-lg border border-slate-border bg-canvas-subtle";
const DETAIL_TILE_CLASS = `${DETAIL_TILE_SURFACE} p-4`;
const COMMENT_TILE_CLASS = `${DETAIL_TILE_SURFACE} p-5`;

const CONTEXT_AVATAR_CLASSES = {
  blue: "bg-blue-surface text-blue-deep",
  secondary: "bg-secondary-container text-on-secondary-fixed",
  orange: "bg-orange-subtle text-orange-deep"
} as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-label-md text-label-md text-text-secondary">{label}</p>
      <div className="mt-1 text-body-md font-body-md text-text-primary break-words">
        {children}
      </div>
    </div>
  );
}

/** Carte de section admin : même anatomie que les autres pages de la console. */
function Card({
  title,
  aside,
  children
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Carte du dossier de signalement : même surface que les autres cartes admin,
 * en-tête local qui accepte plusieurs méta à droite (section, badge). Les cartes
 * 3 et 4 gardent le `Card` partagé, inchangé.
 */
function DetailCard({
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
 * d'un autre administrateur.
 */
function InternalReviewCard({
  reportId,
  myReview
}: {
  reportId: string;
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
        {submitError && (myReview || !confirmation) ? (
          <Alert variant="error" title="Could not submit your review">
            {getApiErrorMessage(submitError)}
          </Alert>
        ) : null}
        {myReview ? (
          <ReadOnlyReview review={myReview} />
        ) : (
          <InternalReviewForm onContinue={setConfirmation} />
        )}
      </DetailCard>
      {!myReview && confirmation ? (
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

/** Tuile de contexte réelle : initiales ou icône, libellé et valeur serveur. */
function ContextTile({
  label,
  value,
  detail,
  initials,
  icon,
  tone
}: {
  label: string;
  value: string;
  detail?: string | null;
  initials?: string;
  icon?: string;
  tone: keyof typeof CONTEXT_AVATAR_CLASSES;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", DETAIL_TILE_CLASS)}>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          CONTEXT_AVATAR_CLASSES[tone]
        )}
      >
        {initials ? (
          <span className="font-label-md text-label-md font-bold">
            {initials}
          </span>
        ) : icon ? (
          <Icon name={icon} className="text-[18px]" />
        ) : null}
      </span>
      <div className="min-w-0">
        <p className={FIELD_LABEL}>{label}</p>
        <p className="mt-0.5 text-body-sm font-body-sm font-semibold text-text-primary break-words">
          {value}
        </p>
        {detail ? <p className={`${MUTED} break-all`}>{detail}</p> : null}
      </div>
    </div>
  );
}

/** Score réel du résultat épinglé : libellé, jauge et valeur sur une ligne. */
function ScoreRow({ label, score }: { label: string; score: number | null }) {
  const value = displayScore(score);

  if (value === null) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className={SCORE_ROW_LABEL}>{label}</p>
        <span className={`${MUTED} shrink-0`}>Not evaluated</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className={`${SCORE_ROW_LABEL} w-[4.5rem] shrink-0`}>{label}</p>
      <div
        role="meter"
        aria-label={`${label} score`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 min-w-0 flex-1 rounded-full border border-slate-border bg-canvas-white p-0.5"
      >
        <div
          className="h-full rounded-full bg-blue-deep"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="flex w-10 shrink-0 justify-end">
        <ScorePercentValue score={value} size="md" />
      </span>
    </div>
  );
}

/** Provenance réelle du résultat ; discrète, y compris quand elle manque. */
function ModelLine({ modelName }: { modelName: string | null }) {
  const model = modelName?.trim();
  return (
    <p className="text-[11px] font-body-sm text-text-tertiary">
      {model ? `Model: ${model}` : "Model not recorded"}
    </p>
  );
}

/**
 * Carte unique du dossier : le signalement et le critère épinglé vivent au même
 * endroit — contexte, commentaire, score/rationale AI, puis les deux liens de
 * sortie. Les cartes 3 et 4 restent des approfondissements.
 */
function ReportCard({ detail }: { detail: AdminCriterionReportDetail }) {
  const report: AdminCriterionReport = detail.report;
  const criterion = detail.criterion;
  const section = report.section;
  const comment = report.comment?.trim() ? report.comment : null;
  const author = reportFullName(
    report.authorFirstName,
    report.authorLastName,
    "Unknown author"
  );
  const candidate = reportFullName(
    report.candidateFirstName,
    report.candidateLastName,
    "Unknown candidate"
  );
  const headerAside =
    section || !criterion.resolved ? (
      <div className="flex flex-wrap items-center gap-2">
        {section ? <CriterionSectionLabel section={section} /> : null}
        {!criterion.resolved ? (
          <Badge tone="neutral">Unresolved</Badge>
        ) : null}
      </div>
    ) : null;

  return (
    <DetailCard title="Report" aside={headerAside}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ContextTile
          label="Reported by"
          value={author}
          detail={report.authorEmail}
          initials={candidateInitials(author)}
          tone="secondary"
        />
        <ContextTile
          label="Candidate"
          value={candidate}
          initials={candidateInitials(candidate)}
          tone="blue"
        />
        <ContextTile
          label="Offer"
          value={
            report.offerTitle?.trim() ? report.offerTitle : "Unknown offer"
          }
          detail={report.companyName}
          icon="work"
          tone="orange"
        />
      </div>

      <div className={COMMENT_TILE_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <CriterionReasonChip reason={report.reason} />
          <span className={`${MUTED} inline-flex items-center gap-1`}>
            <Icon name="event" className="text-[14px]" />
            Reported on {formatShortDate(report.createdAt)}
          </span>
        </div>
        <p className="mt-3 text-body-sm font-body-sm leading-relaxed text-text-secondary break-words whitespace-pre-wrap">
          <span className="font-label-md text-label-md text-text-secondary">
            Comment:
          </span>{" "}
          {comment ? (
            <span className="italic text-text-primary">{comment}</span>
          ) : (
            <span className={MUTED}>No comment left by the recruiter.</span>
          )}
        </p>
      </div>

      {criterion.resolved ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div
            className={cn(
              DETAIL_TILE_CLASS,
              "flex flex-col gap-4 lg:col-span-1"
            )}
          >
            <p className={SCORE_LABEL}>AI score</p>
            <div className="flex flex-1 flex-col justify-center gap-3">
              <ScoreRow label="Criterion" score={criterion.score} />
              <ScoreRow label="Section" score={criterion.sectionScore} />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-blue-border bg-blue-surface/50 p-4 lg:col-span-2">
            <p className="font-label-caps text-label-caps uppercase text-blue-deep">
              AI rationale
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-sm font-body-sm text-text-secondary">
              <span className="font-label-md text-label-md text-text-secondary">
                Requirement
              </span>
              <span className="break-words">
                {criterion.requirement?.trim()
                  ? criterion.requirement
                  : "Not specified"}
              </span>
            </p>
            <p className="text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
              {criterion.rationale?.trim()
                ? criterion.rationale
                : "No AI rationale."}
            </p>
            <div className="mt-auto border-t border-blue-border pt-3">
              <ModelLine modelName={criterion.modelName} />
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(DETAIL_TILE_CLASS, "flex flex-col gap-4")}>
          <p className={`${MUTED} break-words`}>
            This criterion no longer exists in the pinned AI assessment. The
            report is kept as-is — no score or rationale is shown.
          </p>
          <Field label="Criterion key">{criterion.key}</Field>
          <div className="border-t border-slate-border pt-3">
            <ModelLine modelName={criterion.modelName} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-border pt-4">
        {report.offerId ? (
          <NavPill
            href={`/admin/offers/${report.offerId}`}
            icon="open_in_new"
            label="View offer"
          />
        ) : null}
        {detail.candidateUserId ? (
          <NavPill
            href={`/admin/users/${detail.candidateUserId}`}
            icon="badge"
            label="View candidate"
          />
        ) : (
          <span className={`${MUTED} inline-flex items-center gap-1.5`}>
            <Icon name="link_off" className="text-[14px]" />
            Candidate profile unavailable
          </span>
        )}
      </div>
    </DetailCard>
  );
}

/**
 * Contestations du candidat : la note propre du candidat est un désaccord, pas
 * une qualité — aucune bande de lecture, l'écart moyen vient du serveur.
 */
function ContestRow({
  contest,
  reported
}: {
  contest: RecruiterContestationView;
  reported: boolean;
}) {
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-label-md text-label-md text-text-primary font-bold">
          {contest.label}
        </p>
        {reported ? (
          <Badge tone="accent">
            <span className="inline-flex items-center gap-1">
              <Icon name="flag" className="text-[12px]" />
              Reported criterion
            </span>
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-slate-border bg-canvas-white/80 p-2 text-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            AI
          </span>
          <span className="text-body-md font-body-md font-bold text-text-secondary tabular-nums">
            {contest.aiScore}
            <span className={SCORE_UNIT_CLASSES.md}>%</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5 border-x border-slate-border">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            Candidate
          </span>
          <span className="text-body-md font-body-md font-bold text-text-primary tabular-nums">
            {contest.selfValue}
            <span className={SCORE_UNIT_CLASSES.md}>%</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            Gap
          </span>
          <span className="text-body-md font-body-md font-bold text-orange-deep tabular-nums">
            {gapLabel(contest.gap)} pts
          </span>
        </div>
      </div>
      {contest.comment ? (
        <div className="mt-2 flex flex-col gap-1">
          <span className="font-label-md text-label-md text-text-secondary">
            Candidate&apos;s argument
          </span>
          <blockquote className="text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
            {contest.comment}
          </blockquote>
        </div>
      ) : null}
    </li>
  );
}

function ContestationCard({ detail }: { detail: AdminCriterionReportDetail }) {
  const { contests, averageGap, report } = detail;

  return (
    <Card
      title="Candidate contestation"
      aside={
        contests.length > 0 ? (
          <span className={MUTED}>
            {contestSummary(contests.length, averageGap)}
          </span>
        ) : null
      }
    >
      {contests.length === 0 ? (
        <p className={MUTED}>
          The candidate did not contest any criterion of this assessment.
        </p>
      ) : (
        <>
          <ContestGapBlock averageGap={averageGap} size="md" />
          <ul className="flex flex-col gap-3">
            {contests.map((contest) => (
              <ContestRow
                key={contest.criterionKey}
                contest={contest}
                reported={contest.criterionKey === report.criterionKey}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Critère de l'évaluation complète : même lecture que la vue recruteur, sans action. */
function AssessedCriterion({
  criterion,
  reported
}: {
  criterion: RecruiterCriterionView;
  reported: boolean;
}) {
  const score = displayScore(criterion.score);
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-text-primary font-bold">
            {criterion.label}
          </p>
          {criterion.requirement ? (
            <p className={MUTED}>{criterion.requirement}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reported ? (
            <Badge tone="accent">
              <span className="inline-flex items-center gap-1">
                <Icon name="flag" className="text-[12px]" />
                Reported
              </span>
            </Badge>
          ) : null}
          <ScorePercentValue score={score} size="md" />
        </div>
      </div>
      {score !== null ? (
        <div
          role="meter"
          aria-label={criterion.label}
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 rounded-full border border-slate-border bg-slate-surface p-0.5"
        >
          <div
            className="h-full rounded-full bg-blue-deep"
            style={{ width: `${score}%` }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
        {criterion.rationale.trim() ? criterion.rationale : "No AI rationale."}
      </p>
    </li>
  );
}

function AssessedSection({
  section,
  index,
  reportedKey
}: {
  section: RecruiterAssessmentSectionView;
  index: number;
  reportedKey: string;
}) {
  const score = displayScore(section.score);
  return (
    <section
      className={cn(
        index > 0 && "border-t border-slate-border pt-5",
        "flex flex-col gap-3"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IndexBadge>{index + 1}</IndexBadge>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold min-w-0 break-words">
            {RECRUITER_SECTION_LABELS[section.section]}
          </h3>
        </div>
        {score === null ? (
          <span className={MUTED}>Not evaluated</span>
        ) : (
          <ScorePercentChip score={score} size="md" />
        )}
      </div>
      {section.criteria.length === 0 ? (
        <p className={MUTED}>No criteria in this section.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {section.criteria.map((criterion) => (
            <AssessedCriterion
              key={criterion.key}
              criterion={criterion}
              reported={criterion.key === reportedKey}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AssessmentCard({
  assessment,
  reportedKey
}: {
  assessment: RecruiterAssessmentView;
  reportedKey: string;
}) {
  return (
    <Card
      title="Full AI assessment"
      aside={<span className={MUTED}>Read-only</span>}
    >
      {!assessment.available ? (
        <p className={MUTED}>
          No completed AI assessment is linked to this report.
        </p>
      ) : (
        <>
          <p className={MUTED}>
            The pinned AI assessment this report refers to. Reporting never
            changes a score.
          </p>
          <div className="flex flex-col gap-5">
            {assessment.sections.map((section, index) => (
              <AssessedSection
                key={section.section}
                section={section}
                index={index}
                reportedKey={reportedKey}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Dossier admin d'un signalement IA (T-86, D66) : le signalement, le critère
 * tel qu'il a été noté dans le résultat épinglé, les contestations du candidat
 * et l'évaluation complète en lecture seule. Aucune action ici — un
 * signalement est interne et immuable, il ne change ni le score ni la décision.
 */
export function AdminReportDetailView({ reportId }: { reportId: string }) {
  const report = useAdminCriterionReport(reportId);

  if (report.isLoading) {
    return <p className={MUTED}>Loading report…</p>;
  }

  if (report.isError || !report.data) {
    const notFound =
      isAxiosError(report.error) && report.error.response?.status === 404;
    return notFound ? (
      <Alert
        variant="error"
        title="Report not found"
        action={
          <ButtonLink href="/admin/reports" variant="outline-sm">
            Back to AI reports
          </ButtonLink>
        }
      >
        No AI report matches this identifier.
      </Alert>
    ) : (
      <Alert
        variant="error"
        title="Unable to load the report"
        action={
          <RetryButton
            onRetry={() => void report.refetch()}
            label="Try again"
          />
        }
      >
        {getApiErrorMessage(report.error)}
      </Alert>
    );
  }

  const detail = report.data;
  const title = detail.criterion.label || detail.report.criterionKey;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href="/admin/reports">AI reports</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>{title}</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title={title}
      />

      <ReportCard detail={detail} />
      <InternalReviewCard reportId={reportId} myReview={detail.myReview} />
      <ContestationCard detail={detail} />
      <AssessmentCard
        assessment={detail.assessment}
        reportedKey={detail.report.criterionKey}
      />
    </div>
  );
}
