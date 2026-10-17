import type { PublicJob } from "@/types/public-job";
import type {
  JobOffer,
  JobOfferStatusValue,
  QuestionTypeValue,
  SeniorityValue,
} from "@/types/recruiter";
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

/** Libellés des 5 types de question de présélection (D47). */
export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  text: "Text answer",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  yes_no: "Yes / No",
  number: "Number",
};

/** publicId = 12 caractères base36 sans tiret ; le reste de l'URL est le slug cosmétique. */
export const PUBLIC_ID_PATTERN = /^[0-9a-z]{12}$/;

/** Lit le publicId de `[publicId]-[slug]` (pages `/jobs/[job]…`) — null si malformé. */
export function parsePublicId(param: string): string | null {
  const separator = param.indexOf("-");
  if (separator !== 12) {
    return null;
  }
  const publicId = param.slice(0, separator);
  return PUBLIC_ID_PATTERN.test(publicId) ? publicId : null;
}

/** URL publique (V15) : segment unique `{publicId}-{slug}` — fiche, copie de lien, job board. */
export function publicJobPath(publicId: string, slug: string): string {
  return `/jobs/${publicId}-${slug}`;
}

/** Initiales société (1-2 mots) pour la tuile — repli sur l'icône quand absent. */
export function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

/** Icône du chip de modalité de travail, dérivée du label (vocabulaire libre côté seed). */
export function workModeIcon(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("remote")) {
    return "public";
  }
  if (lower.includes("hybrid")) {
    return "home_work";
  }
  return "corporate_fare";
}

/** Date relative courte (« 3 days ago ») — rendu client uniquement (pas d'hydratation à craindre). */
export function relativeTimeLabel(iso: string): string | null {
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) {
    return null;
  }
  const elapsedMinutes = Math.round((value - Date.now()) / 60_000);
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

/** « Expires in N days » (≤ 30 jours) — la pastille « Expired » couvre le passé. */
export function expiryCountdown(expiresAt: string): { label: string; urgent: boolean } | null {
  const date = new Date(`${expiresAt.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    return null;
  }
  if (days === 0) {
    return { label: "Expires today", urgent: true };
  }
  if (days === 1) {
    return { label: "Expires tomorrow", urgent: true };
  }
  if (days <= 30) {
    return { label: `Expires in ${days} days`, urgent: days <= 7 };
  }
  return null;
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

/** Mapping PublicJob → modèle de l'article partagé (fiche publique + prévisualisation). */
export function toPublicJobArticleModel(job: PublicJob): PublicJobArticleModel {
  return {
    companyName: job.companyName,
    title: job.title,
    seniority: job.seniority
      ? SENIORITY_LABELS[job.seniority as SeniorityValue] ?? null
      : null,
    location: locationLabel(job.city, job.country),
    contractType: job.contractType,
    employmentType: job.employmentType,
    workMode: job.workMode,
    salary: salaryLabel(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
    requiredExpYear: job.requiredExpYear,
    publishedAt: job.publishedAt,
    expiresAt: job.expiresAt,
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
