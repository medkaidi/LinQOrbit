"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IndexBadge } from "@/components/ui/index-badge";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
} from "@/components/ui/section";
import {
  CRITERION_REASON_LABELS,
  displayScore,
  RECRUITER_SECTION_LABELS,
  ScorePercentChip,
  ScorePercentValue,
  SectionHeader,
} from "@/features/application/recruiter-application-shared";
import { formatShortDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type {
  RecruiterAssessmentSectionView,
  RecruiterAssessmentView,
  RecruiterCriterionReportView,
  RecruiterCriterionView,
} from "@/types/application";

/**
 * Critère évalué : exigence, score en pourcentage, barre bleue et justification
 * IA. Le critère contesté par le candidat est signalé — le désaccord se lit
 * sans croiser avec le panneau des contestations. Un critère déjà signalé par
 * le lecteur (D66) garde **exactement la même carte** : le signalement est un
 * retour qualité marginal, il ne transforme pas l'item en objet orange. Seul
 * un encart de relecture très discret, en pied, porte la couleur (motif, date,
 * commentaire) ; l'action disparaît : un signalement est immuable.
 */
function CriterionRow({
  criterion,
  contested,
  report,
  onReport,
}: {
  criterion: RecruiterCriterionView;
  contested: boolean;
  report: RecruiterCriterionReportView | undefined;
  onReport: (criterion: RecruiterCriterionView) => void;
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
            <p className={MUTED_TEXT_CLASS}>{criterion.requirement}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {contested ? <Badge tone="accent">Contested</Badge> : null}
          <ScorePercentValue score={score} size="md" />
        </div>
      </div>
      {score === null ? null : (
        <div
          role="meter"
          aria-label={criterion.label}
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 rounded-full border border-slate-border bg-slate-surface p-0.5"
        >
          <div
            className="h-full rounded-full bg-blue-deep transition-[width] duration-500 ease-out"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
        {criterion.rationale.trim() ? criterion.rationale : "No AI rationale."}
      </p>
      <div className="mt-3 border-t border-slate-border pt-3">
        {report ? (
          <div className="rounded border border-orange-border/60 bg-orange-subtle px-2.5 py-1.5">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-orange-deep">
              <Icon name="flag" className="text-[11px]" />
              <span className="font-semibold">Reported</span>
              <span aria-hidden="true">·</span>
              <span>{CRITERION_REASON_LABELS[report.reason]}</span>
              <span aria-hidden="true">·</span>
              <span>{formatShortDate(report.createdAt)}</span>
            </p>
            {report.comment ? (
              <p className="mt-1 text-[11px] leading-snug text-text-secondary whitespace-pre-wrap break-words">
                {report.comment}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <Button variant="outline-sm" onClick={() => onReport(criterion)}>
              <Icon name="flag" className="text-[14px]" />
              Report
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/** Section du matching : score agrégé (pastille) puis critère par critère. */
function AssessmentSection({
  section,
  index,
  contestedKeys,
  reportsByKey,
  onReport,
}: {
  section: RecruiterAssessmentSectionView;
  index: number;
  contestedKeys: Set<string>;
  reportsByKey: Map<string, RecruiterCriterionReportView>;
  onReport: (criterion: RecruiterCriterionView) => void;
}) {
  const score = displayScore(section.score);
  const reportedCount = section.criteria.reduce(
    (count, criterion) => (reportsByKey.has(criterion.key) ? count + 1 : count),
    0,
  );
  return (
    <section
      className={cn(index > 0 && "border-t border-slate-border pt-5", "flex flex-col gap-3")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <IndexBadge>{index + 1}</IndexBadge>
            <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold min-w-0 break-words">
              {RECRUITER_SECTION_LABELS[section.section]}
            </h3>
          </div>
          {reportedCount > 0 ? (
            <p className="flex items-center gap-1 pl-[38px] font-label-md text-label-md font-bold text-orange-deep">
              <Icon name="flag" className="text-[13px]" />
              {reportedCount === 1 ? "1 reported" : `${reportedCount} reported`}
            </p>
          ) : null}
        </div>
        {score === null ? (
          <span className={MUTED_TEXT_CLASS}>Not evaluated</span>
        ) : (
          <ScorePercentChip score={score} size="md" />
        )}
      </div>
      {section.criteria.length === 0 ? (
        <p className={MUTED_TEXT_CLASS}>No criteria in this section.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {section.criteria.map((criterion) => (
            <CriterionRow
              key={criterion.key}
              criterion={criterion}
              contested={contestedKeys.has(criterion.key)}
              report={reportsByKey.get(criterion.key)}
              onReport={onReport}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Évaluation IA épinglée : score par section, justification par critère. */
export function AssessmentCard({
  assessment,
  contestedKeys,
  reportsByKey,
  onReport,
}: {
  assessment: RecruiterAssessmentView;
  contestedKeys: Set<string>;
  reportsByKey: Map<string, RecruiterCriterionReportView>;
  onReport: (criterion: RecruiterCriterionView) => void;
}) {
  const sections = assessment.sections.filter(
    (section) => section.score !== null || section.criteria.length > 0,
  );
  return (
    <section className={SECTION_CARD_CLASS} aria-label="AI assessment">
      <SectionHeader
        title="AI assessment"
        icon="insights"
        aside={assessment.available ? "Pinned matching result" : undefined}
      />
      <div className="px-5 pt-4 pb-5 flex flex-col gap-5">
        {!assessment.available ? (
          <p className={MUTED_TEXT_CLASS}>No AI assessment was attached to this application.</p>
        ) : sections.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>No section was evaluated.</p>
        ) : (
          sections.map((section, index) => (
            <AssessmentSection
              key={section.section}
              section={section}
              index={index}
              contestedKeys={contestedKeys}
              reportsByKey={reportsByKey}
              onReport={onReport}
            />
          ))
        )}
      </div>
    </section>
  );
}
