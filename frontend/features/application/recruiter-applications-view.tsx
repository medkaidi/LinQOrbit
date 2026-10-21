"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  LINK_ACCENT_CLASS,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { ApplicationStatusPill } from "@/features/application/application-shared";
import {
  averageGapValue,
  contestCountLabel,
  contestSummary,
  RECRUITER_SECTION_LABELS,
  recruiterCandidateName,
  scoreBand,
  submittedOnLabel,
  type ScoreBand,
} from "@/features/application/recruiter-application-shared";
import { useRecruiterApplications } from "@/hooks/use-recruiter-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import type {
  RecruiterApplicationCard,
  RecruiterApplicationDirection,
  RecruiterApplicationSortValue,
  RecruiterApplicationStatusValue,
  RecruiterSectionKey,
  RecruiterSectionScore,
} from "@/types/application";

const STATUS_TABS: { value: RecruiterApplicationStatusValue; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS: { value: RecruiterApplicationSortValue; label: string }[] = [
  { value: "submittedAt", label: "Submission date" },
  { value: "requiredSkills", label: "Required skills" },
  { value: "preferredSkills", label: "Preferred skills" },
  { value: "languages", label: "Languages" },
  { value: "experience", label: "Experience" },
  { value: "education", label: "Education" },
  { value: "contests", label: "Contests" },
];

const EMPTY_MESSAGES: Record<RecruiterApplicationStatusValue, string> = {
  submitted: "No submitted applications yet.",
  accepted: "No accepted applications yet.",
  rejected: "No rejected applications yet.",
};

/** La barre reste bleue ; seule la valeur porte le code de lecture vert/orange/gris. */
const SCORE_VALUE_CLASSES: Record<ScoreBand, string> = {
  strong: "text-success-text",
  partial: "text-orange-deep",
  weak: "text-slate-muted",
  none: "text-text-tertiary",
};

/**
 * Ligne de score compacte : label, barre courte bleue, valeur colorée par bande.
 * Le chiffre reste la source de vérité ; aucune note globale.
 */
function SectionScoreRow({
  section,
  highlighted,
}: {
  section: RecruiterSectionScore;
  highlighted: boolean;
}) {
  const score = section.score === null ? null : Math.max(0, Math.min(100, section.score));
  // La couleur suit la valeur arrondie affichée : un « 70 » n'est jamais orange.
  const displayScore = score === null ? null : Math.round(score);
  const band = scoreBand(displayScore);
  const label = RECRUITER_SECTION_LABELS[section.section];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-1.5 py-0.5",
        highlighted && "bg-blue-surface",
      )}
    >
      <div className="w-24 shrink-0">
        <span
          title={label}
          className={cn(
            "block truncate text-[11px] font-semibold leading-tight",
            highlighted ? "font-bold text-blue-deep" : "text-text-secondary",
          )}
        >
          {label}
        </span>
        {score === null ? (
          <span className="block text-[10px] leading-tight text-text-tertiary">Not evaluated</span>
        ) : null}
      </div>
      {score === null ? (
        <span aria-hidden="true" className="h-[3px] w-9 shrink-0" />
      ) : (
        <div
          aria-hidden="true"
          className="h-[3px] w-9 shrink-0 overflow-hidden rounded-full bg-slate-border"
        >
          <div
            className="h-full rounded-full bg-blue-deep transition-[width] duration-500 ease-out"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <span
        className={cn(
          "w-7 shrink-0 text-right text-[11px] font-bold leading-tight tabular-nums",
          SCORE_VALUE_CLASSES[band],
        )}
      >
        {displayScore === null ? "—" : displayScore}
      </span>
    </div>
  );
}

/** Panneau de contestations de la maquette : compteur réel + écart moyen réel, rien d'inventé. */
function ContestPanel({ application }: { application: RecruiterApplicationCard }) {
  const contested = application.contestedCount > 0;
  const gap = averageGapValue(application.averageGap);
  const summary = contestSummary(application.contestedCount, application.averageGap);
  return (
    <div
      role="group"
      aria-label={`Contests: ${summary}`}
      className={cn(
        "flex h-full min-w-0 flex-col justify-between gap-2 rounded-2xl border p-2",
        contested
          ? "border-orange-border/70 bg-orange-subtle/60"
          : "border-slate-border bg-item-surface/60",
      )}
    >
      <span
        className={cn(
          "w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold",
          contested
            ? "border-orange-border bg-orange-subtle text-orange-deep"
            : "border-slate-border bg-canvas-white text-slate-muted",
        )}
      >
        {contestCountLabel(application.contestedCount)}
      </span>
      {contested ? (
        <>
          <div className="rounded-lg border border-orange-border/60 bg-canvas-white/80 px-2 py-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-text-tertiary">
                <Icon name="compare_arrows" className="text-[12px] text-orange-deep/70" />
                Average gap
              </span>
              <span className="text-sm font-bold text-orange-deep tabular-nums">
                {gap === null ? "Not available" : `${gap} pts`}
              </span>
            </div>
          </div>
          <p className="flex items-start gap-1 text-[10px] font-semibold leading-snug text-orange-deep/80">
            <Icon name="info" className="mt-px text-[12px]" />
            Disagreement signal, not a quality score
          </p>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-border bg-canvas-white/80 p-2 text-center">
          <Icon name="check_circle" className="text-[18px] text-text-tertiary" />
          <span className="text-[10px] font-semibold leading-snug text-text-secondary">
            All scores uncontested
          </span>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  offerId,
  application,
  sortedSection,
}: {
  offerId: string;
  application: RecruiterApplicationCard;
  sortedSection: RecruiterSectionKey | null;
}) {
  const name = recruiterCandidateName(application.candidate);
  const candidateTitle = application.candidate?.title?.trim() || null;
  const submittedOn = submittedOnLabel(application.submittedAt);
  const detailHref = `/recruiter/offers/${offerId}/applications/${application.id}`;
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="@container min-w-0 rounded-3xl border border-slate-border bg-canvas-white p-4 shadow-sm transition-colors hover:border-slate-border-strong">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[15rem_auto] @4xl:grid-cols-[15rem_auto_14rem_auto] @4xl:justify-between @4xl:items-stretch">
        <div className="flex min-w-0 items-start gap-4 @xl:self-center">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-surface font-headline-sm text-headline-sm font-bold text-blue-deep"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <Link
              href={detailHref}
              title={name}
              className={cn(
                LINK_ACCENT_CLASS,
                "block truncate font-headline-sm text-headline-sm font-bold tracking-tight",
              )}
            >
              {name}
            </Link>
            {candidateTitle ? (
              <p
                title={candidateTitle}
                className="mt-0.5 truncate text-[11px] font-semibold text-text-secondary"
              >
                {candidateTitle}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ApplicationStatusPill status={application.status} />
              <span className="text-[11px] font-medium text-text-tertiary">
                {submittedOn ? `Applied ${submittedOn}` : "Submission date unavailable"}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-col rounded-2xl border border-slate-border bg-item-surface p-2",
            application.assessmentAvailable
              ? "h-full w-fit justify-center"
              : "min-h-32 w-full items-center justify-center @4xl:col-span-2",
          )}
        >
          {application.assessmentAvailable ? (
            <div className="flex flex-col">
              {application.sections.map((section) => (
                <SectionScoreRow
                  key={section.section}
                  section={section}
                  highlighted={section.section === sortedSection}
                />
              ))}
            </div>
          ) : (
            <p className={cn(MUTED_TEXT_CLASS, "px-2 py-1 text-center")}>No AI assessment</p>
          )}
        </div>

        {application.assessmentAvailable ? <ContestPanel application={application} /> : null}

        <div className="flex items-center @xl:col-start-2 @xl:justify-end @4xl:col-start-4 @4xl:justify-end @4xl:self-center">
          <ButtonLink href={detailHref} variant="outline-sm" className="whitespace-nowrap">
            View application
            <Icon name="arrow_forward" className="text-[14px]" />
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}

/**
 * Vue recruteur des candidatures d'une offre (T-66, D65) : onglets de statut,
 * tri par date, section (nulls last) ou contestations, cartes `rounded-3xl`
 * à quatre zones (identité / cinq lignes de score / contestations / action) et
 * détail lié. Aucun brouillon ni retrait, aucune note globale.
 */
export function RecruiterApplicationsView({ offerId }: { offerId: string }) {
  const [status, setStatus] = useState<RecruiterApplicationStatusValue>("submitted");
  const [sort, setSort] = useState<RecruiterApplicationSortValue>("submittedAt");
  const [direction, setDirection] = useState<RecruiterApplicationDirection>("asc");
  const applications = useRecruiterApplications(offerId, status, sort, direction);
  const pages = applications.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const job = pages[0]?.job;
  const total = pages[0]?.total;
  const sortedSection = sort === "submittedAt" || sort === "contests" ? null : sort;
  const errorMessage = applications.isError ? getApiErrorMessage(applications.error) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/recruiter">Recruiter space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Applications</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Applications"
        subtitle={
          job
            ? `${job.title}${job.companyName ? ` · ${job.companyName}` : ""}`
            : "Applications received for this job offer."
        }
        action={
          <ButtonLink href="/recruiter" variant="outline-sm">
            Back to offers
          </ButtonLink>
        }
      />

      <section className={SECTION_CARD_CLASS}>
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Candidates</h2>
          {applications.data ? (
            <span className={MUTED_TEXT_CLASS}>
              {total === 1 ? "1 application" : `${total ?? 0} applications`}
            </span>
          ) : null}
        </header>

        <div className="px-5 pt-4 pb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              label="Application status"
              value={status}
              options={STATUS_TABS}
              onChange={setStatus}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-52">
                <Select
                  label="Sort by"
                  value={sort}
                  options={SORT_OPTIONS}
                  inlineLabel
                  compact
                  onValueChange={(value) => {
                    const next = value as RecruiterApplicationSortValue;
                    setSort(next);
                    if (next === "contests") {
                      setDirection("asc");
                    }
                  }}
                />
              </div>
              {sort === "contests" ? (
                <span className="text-xs font-semibold text-text-secondary">Fixed order</span>
              ) : (
                <SegmentedControl
                  label="Sort direction"
                  value={direction}
                  options={[
                    { value: "asc", label: "Asc" },
                    { value: "desc", label: "Desc" },
                  ]}
                  onChange={setDirection}
                />
              )}
            </div>
          </div>

          {applications.isLoading ? (
            <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
              <Spinner />
              Loading applications…
            </span>
          ) : null}

          {applications.isError ? (
            <Alert variant="error" title="Could not load applications">
              <div className="flex items-center justify-between gap-3">
                <span>{errorMessage}</span>
                <Button variant="outline-sm" onClick={() => void applications.refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : null}

          <InfiniteList
            items={items}
            keyExtractor={(application) => application.id}
            renderItem={(application) => (
              <CandidateCard
                offerId={offerId}
                application={application}
                sortedSection={sortedSection}
              />
            )}
            hasNextPage={applications.hasNextPage}
            isFetchingNextPage={applications.isFetchingNextPage}
            fetchNextPage={() => void applications.fetchNextPage()}
            loading={applications.isLoading}
            empty={<p className={MUTED_TEXT_CLASS}>{EMPTY_MESSAGES[status]}</p>}
          />
        </div>
      </section>
    </div>
  );
}
