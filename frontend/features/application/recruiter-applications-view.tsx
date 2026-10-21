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
  contestSummary,
  RECRUITER_SECTION_LABELS,
  recruiterCandidateName,
  submittedOnLabel,
} from "@/features/application/recruiter-application-shared";
import { useRecruiterApplications } from "@/hooks/use-recruiter-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import type {
  RecruiterApplicationCard,
  RecruiterApplicationDirection,
  RecruiterApplicationSortValue,
  RecruiterApplicationStatusValue,
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

/** Barre « tube » bleue d'une section, valeur à droite — jamais de note globale. */
function SectionScoreBar({
  section,
  highlighted,
}: {
  section: RecruiterSectionScore;
  highlighted: boolean;
}) {
  const score = section.score === null ? null : Math.max(0, Math.min(100, section.score));
  return (
    <div className={cn("rounded-xl px-2 py-1.5", highlighted && "bg-blue-surface")}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-label-md text-label-md",
            highlighted ? "text-blue-deep font-bold" : "text-text-secondary",
          )}
        >
          {RECRUITER_SECTION_LABELS[section.section]}
        </span>
        <span className="font-label-md text-label-md text-text-primary tabular-nums">
          {score === null ? "Not evaluated" : Math.round(score)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-slate-border bg-slate-surface">
        {score === null ? null : (
          <div
            className="h-full rounded-full bg-blue-deep transition-[width] duration-500 ease-out"
            style={{ width: `${score}%` }}
          />
        )}
      </div>
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
  sortedSection: RecruiterApplicationSortValue;
}) {
  const name = recruiterCandidateName(application.candidate);
  const submittedOn = submittedOnLabel(application.submittedAt);
  const detailHref = `/recruiter/offers/${offerId}/applications/${application.id}`;
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="rounded-2xl border border-slate-border bg-canvas-white p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-surface text-body-md font-bold text-blue-deep"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={detailHref}
                className={cn(
                  LINK_ACCENT_CLASS,
                  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight",
                )}
              >
                {name}
              </Link>
              <p className={MUTED_TEXT_CLASS}>
                {submittedOn ? `Applied ${submittedOn}` : "Submission date unavailable"}
              </p>
            </div>
            <ApplicationStatusPill status={application.status} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        {application.assessmentAvailable ? (
          application.sections.map((section) => (
            <SectionScoreBar
              key={section.section}
              section={section}
              highlighted={section.section === sortedSection}
            />
          ))
        ) : (
          <p className={MUTED_TEXT_CLASS}>No AI assessment</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-border pt-4">
        <span className={MUTED_TEXT_CLASS}>
          {contestSummary(application.contestedCount, application.averageGap)}
        </span>
        <ButtonLink href={detailHref} variant="outline-sm">
          View application
        </ButtonLink>
      </div>
    </li>
  );
}

/**
 * Vue recruteur des candidatures d'une offre (T-66, D65) : onglets de statut,
 * tri par date, section (nulls last) ou contestations, cartes à cinq barres
 * bleues et détail lié. Aucun brouillon ni retrait, aucune note globale.
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

        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
 
            <SegmentedControl
              label="Application status"
              value={status}
              options={STATUS_TABS}
              onChange={setStatus}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-44">
                <Select
                  label="Sort by"
                  value={sort}
                  options={SORT_OPTIONS}
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
                <span className={cn(MUTED_TEXT_CLASS, "pb-2.5")}>Fixed order</span>
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
                sortedSection={sortedSection ?? "submittedAt"}
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
