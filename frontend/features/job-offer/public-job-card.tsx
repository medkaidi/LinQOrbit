import Link from "next/link";
import type { ReactNode } from "react";

import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { ButtonLink, CtaLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import {
  companyInitials,
  expiryCountdown,
  locationLabel,
  relativeTimeLabel,
  salaryLabel,
  seniorityLabel,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";
import type { PublicJobListItem } from "@/types/public-job";

/** Tuile bleue (accent secondaire) : sur un board tout est publié, la couleur porte l'identité, pas un statut. */
const TILE_CLASS = "bg-blue-surface text-blue-deep";

/**
 * Pill de compétence uniforme (neutre) : le board n'hiérarchise pas les
 * compétences — la carte les expose toutes (T-76, transparence candidat).
 */
const META_LINE_ITEM = "inline-flex items-center gap-1.5";
const META_LINE_ICON = "text-[16px] text-text-tertiary";

/**
 * Carte d'une offre publiée du board (T-76). Partagée par le board
 * authentifié (`/jobs`) et la vitrine publique (`/public/jobs`, D100/T-113) :
 * `jobPath` porte la base de la fiche pour que chaque board ouvre sa propre
 * URL ; `applyPath` reste le parcours de candidature, qui est authentifié
 * dans les deux cas (l'AuthGate renvoie vers le login avec retour).
 */
export function PublicJobCard({
  job,
  jobPath,
  applyPath,
}: {
  job: PublicJobListItem;
  jobPath: string;
  applyPath: string;
}) {
  const location = locationLabel(job.city, job.country);
  const seniority = seniorityLabel(job.seniority);
  const salary = salaryLabel(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod,
  );
  const posted = job.publishedAt ? relativeTimeLabel(job.publishedAt) : null;
  const expiry = job.expiresAt ? expiryCountdown(job.expiresAt) : null;

  const meta: ReactNode[] = [];
  if (seniority) {
    meta.push(
      <span key="seniority" className={META_LINE_ITEM}>
        <Icon name="signal_cellular_alt" className={META_LINE_ICON} />
        {seniority}
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
        <Link href={jobPath} className={LINK_ACCENT_CLASS}>
          {job.title}
        </Link>
      </h2>

      {meta.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body-sm font-body-sm text-text-secondary">
          {meta}
        </div>
      ) : null}

      {job.skills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className={MUTED_PILL_CLASS}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4 border-t border-slate-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {expiry ? (
          <span
            className={`inline-flex items-center gap-1.5 font-body-sm font-body-sm ${
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
          <CtaLink icon="bolt" href={applyPath}>
            Apply
          </CtaLink>
        </div>
      </div>
    </li>
  );
}
