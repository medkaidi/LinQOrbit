"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink, CtaLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { Spinner } from "@/components/ui/spinner";
import {
  companyInitials,
  expiryCountdown,
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

/**
 * Pill de compétence uniforme (neutre) : le board n'hiérarchise pas les
 * compétences — la carte les expose toutes (T-76, transparence candidat).
 */
const SKILL_PILL =
  "rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 font-body-sm text-body-sm text-text-secondary";

const META_LINE_ITEM = "inline-flex items-center gap-1.5";
const META_LINE_ICON = "text-[16px] text-text-tertiary";

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
  const expiry = job.expiresAt ? expiryCountdown(job.expiresAt) : null;
  const jobPath = publicJobPath(job.publicId, job.slug);

  const meta: ReactNode[] = [];
  if (seniorityLabel) {
    meta.push(
      <span key="seniority" className={META_LINE_ITEM}>
        <Icon name="signal_cellular_alt" className={META_LINE_ICON} />
        {seniorityLabel}
      </span>,
    );
  }
  if (location) {
    meta.push(
      <span key="location" className={META_LINE_ITEM}>
        <Icon name="location_on" className={META_LINE_ICON} />
        {location}
      </span>,
    );
  }
  if (job.workMode) {
    meta.push(
      <span key="work-mode" className={META_LINE_ITEM}>
        <Icon name={workModeIcon(job.workMode)} className={META_LINE_ICON} />
        {job.workMode}
      </span>,
    );
  }
  if (job.contractType) {
    meta.push(
      <span key="contract" className={META_LINE_ITEM}>
        <Icon name="badge" className={META_LINE_ICON} />
        {job.contractType}
      </span>,
    );
  }
  if (job.employmentType) {
    meta.push(
      <span key="employment-type" className={META_LINE_ITEM}>
        <Icon name="schedule" className={META_LINE_ICON} />
        {job.employmentType}
      </span>,
    );
  }
  if (salary) {
    meta.push(
      <span key="salary" className={`${META_LINE_ITEM} font-semibold text-text-primary`}>
        <Icon name="payments" className={META_LINE_ICON} />
        {salary}
      </span>,
    );
  }

  return (
    <li className="rounded-3xl border border-slate-border bg-canvas-white p-6 shadow-sm transition-colors hover:border-orange-border group/job-board-card flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-label-lg text-label-lg font-bold ${TILE_CLASS}`}
          aria-hidden="true"
        >
          {job.companyName ? (
            companyInitials(job.companyName)
          ) : (
            <Icon name="work" className="text-[24px]" />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={`font-label-md text-label-md uppercase tracking-wider truncate ${job.companyName ? "text-text-primary" : "text-text-tertiary"}`}
          >
            {job.companyName ?? "No company"}
          </p>
          {posted ? (
            <p className="font-body-sm text-body-sm text-text-tertiary">Posted {posted}</p>
          ) : null}
        </div>
      </div>

      <h2 className="font-headline-sm text-headline-sm text-text-primary group-hover/job-board-card:text-orange-deep transition-colors">
        <Link
          href={jobPath}
          className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        >
          {job.title}
        </Link>
      </h2>

      {meta.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body-sm text-body-sm text-text-secondary">
          {meta}
        </div>
      ) : null}

      {job.skills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className={SKILL_PILL}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4 border-t border-slate-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {expiry ? (
          <span
            className={`inline-flex items-center gap-1.5 font-body-sm text-body-sm ${
              expiry.urgent ? "text-orange-deep font-semibold" : "text-text-tertiary"
            }`}
          >
            <Icon name="event" className="text-[16px]" />
            {expiry.label}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink variant="outline-sm" href={jobPath}>
            View job
          </ButtonLink>
          <CtaLink icon="bolt" href={`${jobPath}/apply`}>
            Apply
          </CtaLink>
        </div>
      </div>
    </li>
  );
}

/**
 * Job board (T-72, intégré au shell dashboard en T-74, refonte cartes T-76) :
 * offres publiées non expirées, flux en grille deux colonnes ≥ xl et
 * chargement automatique en bas de liste (`InfiniteList`) — la taille de page
 * est décidée par le backend (D34), aucun filtre à ce jour.
 */
export function PublicJobsView() {
  const query = useInfinitePublicJobs();
  const jobs = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="pb-6 border-b border-slate-border">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
          >
            <Link
              href="/dashboard"
              className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
            >
              Candidate space
            </Link>
            <span aria-hidden="true" className="text-text-tertiary">
              /
            </span>
            <span className="text-text-primary font-semibold">Browse offers</span>
          </nav>
          <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Open positions
          </h1>
        </div>
      </header>

      <div className="w-full">
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
            <InfiniteList
              items={jobs}
              keyExtractor={(job) => job.publicId}
              renderItem={(job) => <PublicJobCard job={job} />}
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              fetchNextPage={query.fetchNextPage}
              listClassName="grid grid-cols-1 gap-4 xl:grid-cols-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
