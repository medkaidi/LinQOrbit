import type { JobOfferStatusValue, SeniorityValue } from "@/types/recruiter";

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
