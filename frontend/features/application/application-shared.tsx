import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill";
import type { ApplicationAnswerView, ApplicationStatusValue } from "@/types/application";

const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  draft: "Draft",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  accepted: "Accepted",
  rejected: "Rejected",
};

/** Tons miroirs du motif `OfferStatusPill` (fond doux + point coloré). */
const STATUS_PILL_TONES: Record<ApplicationStatusValue, StatusPillTone> = {
  draft: { pill: "bg-orange-subtle text-orange-deep", dot: "bg-orange-deep" },
  submitted: { pill: "bg-blue-surface text-blue-deep", dot: "bg-blue-deep" },
  withdrawn: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
  accepted: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  rejected: { pill: "bg-error-subtle text-on-error-container", dot: "bg-error" },
};

/** Pastille de statut d'une candidature — source unique liste / formulaire. */
export function ApplicationStatusPill({ status }: { status: ApplicationStatusValue }) {
  return <StatusPill tone={STATUS_PILL_TONES[status]}>{APPLICATION_STATUS_LABELS[status]}</StatusPill>;
}

/** Date de candidature (« Oct 17, 2026 »), null si l'ISO est illisible. */
export function appliedOnLabel(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

/** Rendu texte d'une réponse reconstruite, selon son type. */
export function answerValueLabel(answer: ApplicationAnswerView): string {
  const { value } = answer;
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((option) => option.label).join(", ");
  }
  return value.label;
}
