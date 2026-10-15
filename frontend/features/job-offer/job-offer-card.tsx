"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { locationLabel, salaryLabel, SENIORITY_LABELS, STATUS_LABELS } from "@/features/job-offer/job-offer-shared";
import type {
  JobOfferStatusValue,
  SalaryPeriodValue,
  SeniorityValue,
} from "@/types/recruiter";

/** Pilule outline-sm habillant un lien (jamais de <button> dans un <a>). */
export const OFFER_LINK_PILL_CLASS =
  "group inline-flex items-center justify-center gap-2 h-8 px-4 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle text-text-primary font-bold text-xs transition-[background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

const OFFER_ROW_CARD = "bg-canvas-white rounded-2xl border border-slate-border p-4 shadow-sm";

const STATUS_PILL_TONES: Record<JobOfferStatusValue, { pill: string; dot: string }> = {
  draft: { pill: "bg-canvas-subtle text-text-secondary", dot: "bg-text-tertiary" },
  validated: { pill: "bg-orange-subtle text-orange-deep", dot: "bg-orange-vibrant" },
  published: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  closed: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
};

/** Pastille de statut à point coloré — inspirée du template offers_listing. */
function StatusPill({ status }: { status: JobOfferStatusValue }) {
  const tone = STATUS_PILL_TONES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps uppercase tracking-wider font-bold shrink-0 ${tone.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Date relative courte (« 3 days ago ») — rendu client uniquement (pas d'hydratation à craindre). */
function createdAgo(iso: string): string | null {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return null;
  }
  const elapsedMinutes = Math.round((created - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(elapsedMinutes) < 60) {
    return rtf.format(elapsedMinutes, "minute");
  }
  const hours = Math.round(elapsedMinutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, "hour");
  }
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return rtf.format(days, "day");
  }
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) {
    return rtf.format(months, "month");
  }
  return rtf.format(Math.round(months / 12), "year");
}

export type JobOfferCardProps = {
  status: JobOfferStatusValue;
  title: string;
  /** Titre-lien vers le détail (console admin) — sans href, titre nu (vue recruteur). */
  titleHref?: string;
  companyName?: string | null;
  seniority?: SeniorityValue | null;
  city?: string | null;
  country?: string | null;
  workModeLabel?: string | null;
  contractTypeLabel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriodValue | null;
  expired?: boolean;
  /** Signal du job de normalisation de l'offre (badge « Analyzing… » / « Analysis failed »). */
  normalization?: "progress" | "failed" | null;
  unvalidatedChanges?: boolean;
  createdAt?: string | null;
  /** Actions alignées à droite (CTA recruteur ou lien « View » admin). */
  actions?: ReactNode;
};

/**
 * Carte d'une offre — présentation partagée vue recruteur / console admin
 * (tuile, pill company, statut, badges, titre, ligne de méta, actions) :
 * les deux payloads (JobOfferListItem, AdminJobOfferListItem) portent les
 * mêmes signaux d'affichage.
 */
export function JobOfferCard({
  status,
  title,
  titleHref,
  companyName,
  seniority,
  city,
  country,
  workModeLabel,
  contractTypeLabel,
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryPeriod,
  expired = false,
  normalization = null,
  unvalidatedChanges = false,
  createdAt,
  actions,
}: JobOfferCardProps) {
  const location = locationLabel(city ?? null, country ?? null);
  const place = workModeLabel ? [workModeLabel, location].filter(Boolean).join(" · ") : location;
  const seniorityLabel = seniority ? SENIORITY_LABELS[seniority] : null;
  const salary = salaryLabel(salaryMin ?? null, salaryMax ?? null, salaryCurrency ?? null, salaryPeriod ?? null);
  const created = createdAt ? createdAgo(createdAt) : null;

  const meta: ReactNode[] = [];
  if (seniorityLabel) {
    meta.push(<span key="seniority">{seniorityLabel}</span>);
  }
  if (place) {
    meta.push(
      <span key="location" className="flex items-center gap-1">
        <Icon
          name={workModeLabel?.toLowerCase() === "remote" ? "public" : "location_on"}
          className="text-[16px] text-text-tertiary"
        />
        {place}
      </span>,
    );
  }
  if (contractTypeLabel) {
    meta.push(
      <span key="contract" className="flex items-center gap-1">
        <Icon name="badge" className="text-[16px] text-text-tertiary" />
        {contractTypeLabel}
      </span>,
    );
  }
  if (salary) {
    meta.push(
      <span key="salary" className="font-semibold text-text-primary">
        {salary}
      </span>,
    );
  }

  return (
    <li
      className={`${OFFER_ROW_CARD} group/offer flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        status === "draft" ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div
          className={`w-12 h-12 mt-0.5 rounded-xl flex items-center justify-center shrink-0 ${
            status === "draft" || status === "closed"
              ? "bg-canvas-subtle text-text-secondary"
              : "bg-orange-subtle text-orange-deep"
          }`}
        >
          <Icon name="work" className="text-[24px]" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {companyName ? (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-text-primary font-label-caps text-label-caps uppercase shrink-0">
                {companyName}
              </span>
            ) : null}
            <StatusPill status={status} />
            {expired ? <Badge tone="neutral">Expired</Badge> : null}
            {normalization === "progress" ? (
              <Badge>Analyzing…</Badge>
            ) : normalization === "failed" ? (
              <Badge tone="neutral">Analysis failed</Badge>
            ) : unvalidatedChanges && status === "validated" ? (
              <Badge>Unvalidated changes</Badge>
            ) : null}
            {created ? (
              <span className="font-body-sm text-body-sm text-text-tertiary">
                Created {created}
              </span>
            ) : null}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary group-hover/offer:text-orange-deep transition-colors truncate">
            {titleHref ? (
              <Link
                href={titleHref}
                className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body-sm text-body-sm text-text-secondary">
            {meta.flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <span key={`sep-${index}`} className="text-text-tertiary">
                      •
                    </span>,
                    part,
                  ],
            )}
          </div>
        </div>
      </div>
      {actions}
    </li>
  );
}
