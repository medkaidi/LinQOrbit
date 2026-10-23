import {
  CRITERION_REASON_LABELS,
  recruiterSectionLabel,
} from "@/features/application/recruiter-application-shared";
import type { CriterionReportReason } from "@/types/application";

/** Couleurs de lecture du motif — aucune sévérité, aucune priorité inventée. */
const REASON_CHIP_CLASSES: Record<CriterionReportReason, string> = {
  scoreIncorrect: "border-orange-border bg-orange-subtle text-orange-deep",
  evidenceWrong: "border-blue-border bg-blue-surface text-blue-deep",
  profileMisunderstood:
    "border-secondary-fixed-dim bg-secondary-container text-on-secondary-fixed",
  requirementMisunderstood:
    "border-slate-border-strong bg-surface-container-low text-slate-ink",
  other: "border-slate-border bg-canvas-subtle text-text-secondary",
};

/** Repère de section : couleur de catégorie, jamais de statut. */
const SECTION_DOT_CLASSES: Record<string, string> = {
  requiredSkills: "bg-blue-deep",
  preferredSkills: "bg-secondary",
  languages: "bg-orange-deep",
  experience: "bg-slate-muted",
  education: "bg-slate-ink",
};

export function reportFullName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name.length > 0 ? name : fallback;
}

export function CriterionReasonChip({ reason }: { reason: CriterionReportReason }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-label-caps text-label-caps normal-case tracking-normal font-bold ${REASON_CHIP_CLASSES[reason]}`}
    >
      {CRITERION_REASON_LABELS[reason]}
    </span>
  );
}

export function CriterionSectionLabel({ section }: { section: string | null }) {
  const label = recruiterSectionLabel(section);
  const dot = SECTION_DOT_CLASSES[section ?? ""] ?? "bg-text-tertiary";
  return (
    <span className="inline-flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-text-secondary">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label ?? "Unknown section"}
    </span>
  );
}
