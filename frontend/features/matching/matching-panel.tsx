"use client";

import { isAxiosError } from "axios";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { Spinner } from "@/components/ui/spinner";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { ClarificationPanel } from "@/features/matching/clarification-panel";
import { MATCHING_SECTION_LABELS } from "@/features/matching/matching-shared";
import {
  useAssessmentStepSync,
  useCurrentMatching,
  useMatchingStatusStream,
  useStartMatching,
} from "@/hooks/use-matching";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { MatchingCriterion, MatchingSection } from "@/types/matching";

function CriterionScore({ criterion }: { criterion: MatchingCriterion }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm font-body-sm font-semibold text-text-primary min-w-0 break-words">
          {criterion.label}
        </span>
        <span className="font-mono text-body-sm text-text-primary shrink-0">{criterion.score}%</span>
      </div>
      <div
        role="meter"
        aria-label={criterion.label}
        aria-valuenow={criterion.score}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 rounded-full bg-slate-surface overflow-hidden"
      >
        <div className="h-full rounded-full bg-primary-container" style={{ width: `${criterion.score}%` }} />
      </div>
    </li>
  );
}

function SectionScores({ section }: { section: MatchingSection }) {
  return (
    <section aria-label={MATCHING_SECTION_LABELS[section.section]} className="flex flex-col gap-3">
      <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
        {MATCHING_SECTION_LABELS[section.section]}
      </h3>
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
 * sans clic), échec + relance, puis le score de chaque critère par section et
 * les clarifications IA (T-62) — une réévaluation garde les scores précédents
 * à l'écran. Le candidat ne voit ni poids, ni score de section, ni
 * justification (réservés au recruteur).
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
            <CtaButton type="button" icon="insights" busy={start.isPending} onClick={run}>
              Run the match
            </CtaButton>
          </div>
        ) : null}

        {matching.isError && !notStarted ? (
          <Alert variant="error" title="Could not load your match">
            {getApiErrorMessage(matching.error)}
          </Alert>
        ) : null}

        {inProgress && sections.length > 0 ? (
          <Alert variant="info" title="Updating your match…">
            Your input is being taken into account. Your scores below are the previous ones until the
            new analysis ends — this panel updates automatically.
          </Alert>
        ) : null}
        {inProgress && sections.length === 0 ? (
          <Alert variant="info" title="Analysis in progress">
            Your profile is being compared with this offer. It usually takes less than a minute — this
            panel updates automatically.
          </Alert>
        ) : null}

        {status === "failed" ? (
          <div className="flex flex-col items-start gap-3">
            <Alert variant="error" title="The analysis failed">
              Your match could not be computed. You can run it again.
            </Alert>
            <CtaButton type="button" icon="refresh" busy={start.isPending} onClick={run}>
              Run the match again
            </CtaButton>
          </div>
        ) : null}

        {status === "done" && matching.data ? (
          <ClarificationPanel publicId={publicId} matching={matching.data} />
        ) : null}

        {sections.length > 0 ? (
          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <SectionScores key={section.section} section={section} />
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
