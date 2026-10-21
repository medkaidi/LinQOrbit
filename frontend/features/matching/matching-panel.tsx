"use client";

import { isAxiosError } from "axios";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { IndexBadge } from "@/components/ui/index-badge";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { MATCHING_SECTION_LABELS } from "@/features/matching/matching-shared";
import {
  useAssessmentStepSync,
  useCurrentMatching,
  useMatchingStatusStream,
  useStartMatching,
} from "@/hooks/use-matching";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import type { MatchingCriterion, MatchingSection } from "@/types/matching";

/**
 * Statut « analyse en cours » de l'en-tête (T-89) : l'orange reste le signal
 * d'activité — les données, elles, sont bleues (accent secondaire).
 */
const ANALYZING_TONE: StatusPillTone = {
  pill: "bg-orange-subtle text-orange-deep",
  dot: "bg-orange-deep animate-pulse motion-reduce:animate-none",
};

function CriterionScore({ criterion }: { criterion: MatchingCriterion }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm font-body-sm font-semibold text-text-primary min-w-0 break-words">
          {criterion.label}
        </span>
        <span className="font-mono text-body-sm text-text-primary shrink-0 tabular-nums">
          {criterion.score}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={criterion.label}
        aria-valuenow={criterion.score}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 rounded-full bg-slate-surface border border-slate-border p-0.5"
      >
        <div
          className="h-full rounded-full bg-blue-deep transition-[width] duration-500 ease-out"
          style={{ width: `${criterion.score}%` }}
        />
      </div>
    </li>
  );
}

/** Section de scores : même anatomie d'en-tête que la revue candidat (T-63). */
function SectionScores({ section, index }: { section: MatchingSection; index: number }) {
  return (
    <section
      aria-label={MATCHING_SECTION_LABELS[section.section]}
      className={cn("flex flex-col gap-3", index > 0 && "border-t border-slate-border pt-6")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <IndexBadge>{index + 1}</IndexBadge>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-text-primary min-w-0 break-words">
            {MATCHING_SECTION_LABELS[section.section]}
          </h3>
        </div>
        <span className={MUTED_TEXT_CLASS}>
          {section.criteria.length} {section.criteria.length === 1 ? "criterion" : "criteria"}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {section.criteria.map((criterion) => (
          <CriterionScore key={criterion.key} criterion={criterion} />
        ))}
      </ul>
    </section>
  );
}

/** 404 = aucun matching lancé pour la fiche courante : état « à lancer », pas une erreur. */
function isNotStarted(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

/**
 * Matching du candidat pour l'offre (D58) : lancement facultatif, analyse
 * asynchrone suivie en **push SSE** (D60 — le panneau se met à jour seul,
 * sans clic), échec + relance, puis le score de chaque critère par section —
 * une réévaluation garde les scores précédents à l'écran. Les clarifications
 * IA sont rendues par le parcours (contenu central, refonte D6), jamais ici.
 * Le candidat ne voit ni poids, ni score de section, ni justification
 * (réservés au recruteur). Rendu (T-89) : en-têtes de section numérotés avec
 * compteur, barres « tube » bleues, statut d'analyse en pastille d'en-tête —
 * l'orange est réservé au signal d'activité, jamais aux données.
 */
export function MatchingPanel({
  publicId,
  prepare,
  stepAssessmentFinished,
}: {
  publicId: string;
  /** Préalable au lancement (création du brouillon d'une offre sans question, D59). */
  prepare?: () => Promise<unknown>;
  /** Évaluation close selon le contexte du parcours (serveur) — relu quand le matching le contredit. */
  stepAssessmentFinished?: boolean;
}) {
  const matching = useCurrentMatching(publicId);
  const start = useStartMatching(publicId);
  const run = () => start.mutate(prepare);

  const notStarted = matching.isError && isNotStarted(matching.error);
  const status = matching.data?.status;
  const inProgress = status === "pending" || status === "running";
  const sections = matching.data?.sections ?? [];
  useMatchingStatusStream(publicId, inProgress);
  useAssessmentStepSync(publicId, matching.data, stepAssessmentFinished);

  return (
    <section className={SECTION_CARD_CLASS} aria-label="Your match">
      <header className={SECTION_HEADER_CLASS}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBadge icon="insights" />
          <h2 className={SECTION_TITLE_CLASS}>Your match</h2>
        </div>
        {inProgress ? (
          <span role="status">
            <StatusPill tone={ANALYZING_TONE}>Analyzing…</StatusPill>
          </span>
        ) : null}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
        {matching.isLoading ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </span>
        ) : null}

        {notStarted ? (
          <div className="flex flex-col items-start gap-4">
            <p className={MUTED_TEXT_CLASS}>
              Compare your professional profile with this offer, criterion by criterion. This step is
              optional and does not send your application.
            </p>
            <CtaButton
              type="button"
              icon="insights"
              tone="secondary"
              busy={start.isPending}
              onClick={run}
            >
              Run the match
            </CtaButton>
          </div>
        ) : null}

        {matching.isError && !notStarted ? (
          <Alert variant="error" title="Could not load your match">
            {getApiErrorMessage(matching.error)}
          </Alert>
        ) : null}

        {inProgress && sections.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>
            Your profile is being compared with this offer. It usually takes less than a minute —
            this panel updates automatically.
          </p>
        ) : null}
        {inProgress && sections.length > 0 ? (
          <p className={MUTED_TEXT_CLASS}>
            Your input is being taken into account. Your scores below are the previous ones until
            the new analysis ends — this panel updates automatically.
          </p>
        ) : null}

        {status === "failed" ? (
          <div className="flex flex-col items-start gap-3">
            <Alert variant="error" title="The analysis failed">
              Your match could not be computed. You can run it again.
            </Alert>
            <CtaButton
              type="button"
              icon="refresh"
              tone="secondary"
              busy={start.isPending}
              onClick={run}
            >
              Run the match again
            </CtaButton>
          </div>
        ) : null}

        {sections.length > 0 ? (
          <div className="flex flex-col gap-6">
            {sections.map((section, index) => (
              <SectionScores key={section.section} section={section} index={index} />
            ))}
          </div>
        ) : null}
        {status === "done" && sections.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>This offer has no criterion to compare yet.</p>
        ) : null}

        {start.error ? (
          <Alert variant="error" title="Could not run the match">
            {getApiErrorMessage(start.error)}
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
