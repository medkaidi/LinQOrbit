"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { MetaChip, OFFER_SALARY_CHIP } from "@/features/job-offer/job-offer-card";
import {
  companyInitials,
  locationLabel,
  publicJobPath,
  relativeTimeLabel,
  salaryLabel,
  SENIORITY_LABELS,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";
import { useInfinitePublicJobs } from "@/hooks/use-public-jobs";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { PublicJobListItem } from "@/types/public-job";
import type { SeniorityValue } from "@/types/recruiter";

/** Tuile bleue (accent secondaire) : sur un board tout est publié, la couleur porte l'identité, pas un statut. */
const TILE_CLASS = "bg-blue-surface text-blue-deep";

function PublicJobCard({ job }: { job: PublicJobListItem }) {
  const location = locationLabel(job.city, job.country);
  const seniorityLabel = job.seniority
    ? (SENIORITY_LABELS[job.seniority as SeniorityValue] ?? null)
    : null;
  const salary = salaryLabel(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod,
  );
  const posted = job.publishedAt ? relativeTimeLabel(job.publishedAt) : null;

  const metaChips: ReactNode[] = [];
  if (seniorityLabel) {
    metaChips.push(
      <MetaChip key="seniority" icon="signal_cellular_alt">
        {seniorityLabel}
      </MetaChip>,
    );
  }
  if (location) {
    metaChips.push(
      <MetaChip key="location" icon="location_on">
        {location}
      </MetaChip>,
    );
  }
  if (job.workMode) {
    metaChips.push(
      <MetaChip key="work-mode" icon={workModeIcon(job.workMode)}>
        {job.workMode}
      </MetaChip>,
    );
  }
  if (job.contractType) {
    metaChips.push(
      <MetaChip key="contract" icon="badge">
        {job.contractType}
      </MetaChip>,
    );
  }
  if (job.employmentType) {
    metaChips.push(
      <MetaChip key="employment-type" icon="schedule">
        {job.employmentType}
      </MetaChip>,
    );
  }
  if (salary) {
    metaChips.push(
      <span key="salary" className={OFFER_SALARY_CHIP}>
        <Icon name="payments" className="text-[14px]" />
        {salary}
      </span>,
    );
  }

  return (
    <li className="rounded-2xl border border-slate-border bg-canvas-white p-4 shadow-sm group/job-board-card flex flex-col gap-3">
      <div className="flex items-start gap-4 min-w-0">
        <div
          className={`w-12 h-12 mt-0.5 rounded-xl flex items-center justify-center shrink-0 font-label-lg text-label-lg font-bold ${TILE_CLASS}`}
          aria-hidden="true"
        >
          {job.companyName ? (
            companyInitials(job.companyName)
          ) : (
            <Icon name="work" className="text-[24px]" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span
              className={`font-label-md text-label-md uppercase tracking-wider shrink-0 ${job.companyName ? "text-text-primary" : "text-text-tertiary"}`}
            >
              {job.companyName ?? "No company"}
            </span>
            {posted ? (
              <span className="font-body-sm text-body-sm text-text-tertiary">
                Posted {posted}
              </span>
            ) : null}
          </div>
          <h2 className="font-headline-sm text-headline-sm text-text-primary group-hover/job-board-card:text-orange-deep transition-colors truncate">
            <Link
              href={publicJobPath(job.publicId, job.slug)}
              className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
            >
              {job.title}
            </Link>
          </h2>
          {metaChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">{metaChips}</div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Job board public (T-72) : offres publiées non expirées, infinite scroll —
 * la taille de page est décidée par le backend (D34), aucun filtre à ce jour.
 */
export function PublicJobsView() {
  const query = useInfinitePublicJobs();
  const jobs = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:py-14">
      <header>
        <p className="font-label-md text-label-md uppercase tracking-wider text-primary-container">
          Job board
        </p>
        <h1 className="mt-2 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Open positions
        </h1>
        <p className="mt-3 text-body-md font-body-md text-text-secondary">
          Published offers across LinQOrbit companies, most recent first.
        </p>
      </header>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading jobs…
          </div>
        ) : query.isError ? (
          <Alert
            variant="error"
            title="Couldn't load offers"
            action={
              <Button variant="outline-sm" onClick={() => query.refetch()}>
                Retry
              </Button>
            }
          >
            {getApiErrorMessage(query.error)}
          </Alert>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-border bg-canvas-white px-6 py-12 text-center shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-text-primary">
              No open positions right now
            </h2>
            <p className="mt-2 text-body-sm font-body-sm text-text-secondary">
              Published offers will show up here as companies open roles.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="font-body-sm text-body-sm text-text-tertiary">
              {total} {total === 1 ? "offer" : "offers"}
            </p>
            <ul className="flex flex-col gap-4">
              {jobs.map((job) => (
                <PublicJobCard key={job.publicId} job={job} />
              ))}
            </ul>
            {query.hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  busy={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
