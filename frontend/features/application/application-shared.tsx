import type { ApplicationAnswerView, ApplicationStatusValue } from "@/types/application";

export const APPLICATION_SECTION = "bg-canvas-white rounded-2xl shadow-sm";
export const APPLICATION_SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex items-start justify-between gap-4 border-b border-slate-border";
export const APPLICATION_SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
export const APPLICATION_ITEM = "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
export const APPLICATION_MUTED = "text-body-sm font-body-sm text-text-secondary";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  accepted: "Accepted",
  rejected: "Rejected",
};

/** Tons miroirs du motif `OfferStatusPill` (fond doux + point coloré). */
const STATUS_PILL_TONES: Record<ApplicationStatusValue, { pill: string; dot: string }> = {
  submitted: { pill: "bg-blue-surface text-blue-deep", dot: "bg-blue-deep" },
  withdrawn: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
  accepted: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  rejected: { pill: "bg-error-subtle text-on-error-container", dot: "bg-error" },
};

/** Pastille de statut d'une candidature — source unique liste / formulaire. */
export function ApplicationStatusPill({ status }: { status: ApplicationStatusValue }) {
  const tone = STATUS_PILL_TONES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps normal-case tracking-normal font-bold shrink-0 ${tone.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
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
