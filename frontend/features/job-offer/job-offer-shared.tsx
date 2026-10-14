import type { PublicJob } from "@/types/public-job";
import type { JobOffer, JobOfferStatusValue, SeniorityValue } from "@/types/recruiter";
import type { PublicJobArticleModel } from "@/features/job-offer/public-job-article";

export const OFFER_SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex items-start justify-between gap-4 border-b border-slate-border";
export const OFFER_SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
export const OFFER_ITEM_CARD = "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
export const OFFER_MUTED = "text-body-sm font-body-sm text-text-secondary";

export const STATUS_LABELS: Record<JobOfferStatusValue, string> = {
  draft: "Draft",
  validated: "Validated",
  published: "Published",
  closed: "Closed",
};

export const SENIORITY_LABELS: Record<SeniorityValue, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
};

export function salaryLabel(
  salaryMin: number | null,
  salaryMax: number | null,
  currency: string | null,
  period: string | null,
): string | null {
  if (salaryMin === null && salaryMax === null) {
    return null;
  }
  const format = (value: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
  const range =
    salaryMin !== null && salaryMax !== null
      ? `${format(salaryMin)} – ${format(salaryMax)}`
      : salaryMin !== null
        ? `From ${format(salaryMin)}`
        : salaryMax !== null
          ? `Up to ${format(salaryMax)}`
          : null;
  if (range === null) {
    return null;
  }
  return [range, currency, period ? `per ${period}` : null].filter(Boolean).join(" ");
}

export function locationLabel(city: string | null, country: string | null): string | null {
  const label = [city, country].filter(Boolean).join(", ");
  return label === "" ? null : label;
}

/** Ligne de méta-données d'une fiche publique (company · lieu · séniorité · …). */
export function publicJobMetaLine(job: PublicJob): string[] {
  const seniority = job.seniority
    ? SENIORITY_LABELS[job.seniority as SeniorityValue] ?? null
    : null;
  return [
    job.companyName,
    locationLabel(job.city, job.country),
    seniority,
    job.contractType,
    job.employmentType,
    job.workMode,
    salaryLabel(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
  ].filter((part): part is string => Boolean(part));
}

/** Mapping PublicJob → modèle de l'article partagé (fiche publique + console admin). */
export function toPublicJobArticleModel(job: PublicJob): PublicJobArticleModel {
  return {
    companyName: job.companyName,
    title: job.title,
    meta: publicJobMetaLine(job),
    description: job.description,
    skills: job.skills.map((skill) => ({
      id: skill.skillId,
      name: skill.name,
      requirementType: skill.requirementType,
    })),
    languages: job.languages.map((language) => ({
      id: language.languageId,
      name: language.name,
      level: language.level,
    })),
    degreeLabels: job.degreeLabels,
    studyFieldLabels: job.studyFieldLabels,
  };
}

/** Message d'infobulle quand l'offre est trop incomplète pour sortir du brouillon. */
export const OFFER_INCOMPLETE_TOOLTIP =
  "Add a description, a country, an employment type and at least one skill before publishing.";

/**
 * Complétude minimale d'une offre (miroir des validations backend/Zod) :
 * description, country, employment type et au moins une compétence.
 */
export function isOfferReadyToPublish(
  offer: Pick<JobOffer, "description" | "country" | "employmentTypeId" | "skills">,
): boolean {
  return Boolean(
    offer.description && offer.country && offer.employmentTypeId && offer.skills.length > 0,
  );
}

/**
 * Offre publiée expirée (miroir de getPublic : `expiresAt` strictement avant
 * aujourd'hui — à date d'expiry l'offre reste visible). La page publique rend
 * 404 ; ce signal aligne la liste sur ce comportement.
 */
export function isOfferExpired(offer: Pick<JobOffer, "status" | "expiresAt">): boolean {
  return (
    offer.status === "published" &&
    offer.expiresAt !== null &&
    offer.expiresAt < new Date().toISOString().slice(0, 10)
  );
}
