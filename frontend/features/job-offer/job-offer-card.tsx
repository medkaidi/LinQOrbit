"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill";
import { META_CHIP_CLASS, META_CHIP_URGENT_CLASS } from "@/components/ui/pill";
import {
  companyInitials,
  expiryCountdown,
  locationLabel,
  relativeTimeLabel,
  salaryLabel,
  SENIORITY_LABELS,
  STATUS_LABELS,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";
import type {
  JobOfferStatusValue,
  SalaryPeriodValue,
  SeniorityValue,
} from "@/types/recruiter";

const OFFER_ROW_CARD = "bg-canvas-white rounded-2xl border border-slate-border p-4 shadow-sm";

const META_CHIP_ICON = "text-[14px] text-text-tertiary";
export const OFFER_SALARY_CHIP =
  "inline-flex items-center gap-1 rounded-full bg-orange-subtle px-2.5 py-1 font-body-sm text-body-sm font-semibold text-orange-deep";

const STATUS_PILL_TONES: Record<JobOfferStatusValue, StatusPillTone> = {
  draft: { pill: "bg-canvas-subtle text-text-secondary", dot: "bg-text-tertiary" },
  validated: { pill: "bg-orange-subtle text-orange-deep", dot: "bg-orange-vibrant" },
  published: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  closed: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
};

/** Tuile à initiales : tons miroirs de la pilule de statut (surfaces douces). */
const TILE_TONE_MUTED = "bg-canvas-subtle text-text-secondary";
const TILE_TONES: Record<JobOfferStatusValue, string> = {
  draft: TILE_TONE_MUTED,
  validated: "bg-orange-subtle text-orange-deep",
  published: "bg-success-surface text-success-text",
  closed: "bg-slate-surface text-text-secondary",
};

/** Pastille de statut à point coloré — partagée carte / détail admin (source unique). */
export function OfferStatusPill({ status }: { status: JobOfferStatusValue }) {
  return <StatusPill tone={STATUS_PILL_TONES[status]}>{STATUS_LABELS[status]}</StatusPill>;
}

/**
 * Chip méta d'une carte d'offre (icône + libellé) — langage visuel partagé
 * carte recruteur / fiche publique. `urgent` = échéance proche : surface
 * orange, l'icône hérite de la couleur du texte.
 */
export function MetaChip({
  icon,
  urgent = false,
  children,
}: {
  icon: string;
  urgent?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={urgent ? META_CHIP_URGENT_CLASS : META_CHIP_CLASS}>
      <Icon name={icon} className={urgent ? "text-[14px]" : META_CHIP_ICON} />
      {children}
    </span>
  );
}

type JobOfferCardProps = {
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
  employmentTypeLabel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriodValue | null;
  expired?: boolean;
  /** Signal du job de normalisation de l'offre (badge « Analyzing… » / « Analysis failed »). */
  normalization?: "progress" | "failed" | null;
  unvalidatedChanges?: boolean;
  /** Draft incomplet (gate de complétude serveur) : chip « Not ready to publish ». */
  readyToPublish?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
  /** Actions alignées à droite (CTA recruteur ou lien « View » admin). */
  actions?: ReactNode;
};

/**
 * Carte d'une offre — présentation partagée vue recruteur / console admin :
 * tuile à initiales, en-tête de vie (company, statut, badges), titre, méta en
 * chips (lieu, mode, contrat, type d'emploi, salaire) puis ligne de dates
 * (Created / Updated / échéance proche). Les deux payloads (JobOfferListItem,
 * AdminJobOfferListItem) portent les mêmes signaux d'affichage.
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
  employmentTypeLabel,
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryPeriod,
  expired = false,
  normalization = null,
  unvalidatedChanges = false,
  readyToPublish = true,
  createdAt,
  updatedAt,
  expiresAt,
  actions,
}: JobOfferCardProps) {
  const location = locationLabel(city ?? null, country ?? null);
  const seniorityLabel = seniority ? SENIORITY_LABELS[seniority] : null;
  const salary = salaryLabel(salaryMin ?? null, salaryMax ?? null, salaryCurrency ?? null, salaryPeriod ?? null);
  const created = createdAt ? relativeTimeLabel(createdAt) : null;
  const updated =
    updatedAt && updatedAt !== createdAt ? relativeTimeLabel(updatedAt) : null;
  const expiry =
    status === "published" && expiresAt && !expired ? expiryCountdown(expiresAt) : null;

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
  if (workModeLabel) {
    metaChips.push(
      <MetaChip key="work-mode" icon={workModeIcon(workModeLabel)}>
        {workModeLabel}
      </MetaChip>,
    );
  }
  if (contractTypeLabel) {
    metaChips.push(
      <MetaChip key="contract" icon="badge">
        {contractTypeLabel}
      </MetaChip>,
    );
  }
  if (employmentTypeLabel) {
    metaChips.push(
      <MetaChip key="employment-type" icon="schedule">
        {employmentTypeLabel}
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
    <li className={`${OFFER_ROW_CARD} group/offer flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div
          className={`w-12 h-12 mt-0.5 rounded-xl flex items-center justify-center shrink-0 font-label-lg text-label-lg font-bold ${expired ? TILE_TONE_MUTED : TILE_TONES[status]}`}
          aria-hidden="true"
        >
          {companyName ? companyInitials(companyName) : <Icon name="work" className="text-[24px]" />}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {/* Société : plaque d'identité en tête de rangée — seul bloc en capitales (avec tracking),
                text-primary ; les pastilles de statut sont en casse de phrase ; jamais une capsule. */}
            <span
              className={`font-label-md text-label-md uppercase tracking-wider shrink-0 ${companyName ? "text-text-primary" : "text-text-tertiary"}`}
            >
              {companyName ?? "No company"}
            </span>
            <OfferStatusPill status={status} />
            {expired ? <Badge tone="neutral">Expired</Badge> : null}
            {normalization === "progress" ? (
              <Badge>Analyzing…</Badge>
            ) : normalization === "failed" ? (
              <Badge tone="neutral">Analysis failed</Badge>
            ) : unvalidatedChanges && status === "validated" ? (
              <Badge>Unvalidated changes</Badge>
            ) : null}
            {status === "draft" && !readyToPublish ? (
              <Badge tone="neutral">Not ready to publish</Badge>
            ) : null}
            {/* Dates de vie fusionnées à la rangée des badges (une ligne à elles seules n'est pas justifiée). */}
            {created || updated || expiry ? (
              <div className="flex flex-wrap items-center gap-x-2 font-body-sm text-body-sm text-text-tertiary">
                {created ? <span>Created {created}</span> : null}
                {updated ? <span>Updated {updated}</span> : null}
                {expiry ? (
                  <span className={expiry.urgent ? "text-orange-deep font-semibold" : undefined}>
                    {expiry.label}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary group-hover/offer:text-orange-deep transition-colors truncate">
            {titleHref ? (
              <Link href={titleHref} className={LINK_ACCENT_CLASS}>
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {metaChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">{metaChips}</div>
          ) : null}
        </div>
      </div>
      {actions}
    </li>
  );
}
