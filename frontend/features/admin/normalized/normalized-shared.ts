import type { SkillCategory } from "@/types/normalized";

/** Labels lisibles de la taxonomie de compétences (miroir des schémas IA). */
export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  programming_language: "Programming language",
  framework: "Framework",
  library: "Library",
  tool: "Tool",
  methodology: "Methodology",
  business_domain: "Business domain",
  soft_skill: "Soft skill",
  technical_skill: "Technical skill",
  regulatory_knowledge: "Regulatory knowledge",
  other: "Other",
};

export const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
};

export const PROJECT_CONTEXT_LABELS: Record<string, string> = {
  personal: "Personal",
  academic: "Academic",
  open_source: "Open source",
  professional: "Professional",
  volunteer: "Volunteer",
  other: "Other",
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2024-03" → "Mar 2024" ; valeur absente ou mal formée → null. */
export function formatMonth(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) {
    return value;
  }
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** Période "Sep 2020 – Mar 2023" / "Sep 2020 – Present" (fin null). */
export function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const start = formatMonth(startDate);
  if (!start) {
    return null;
  }
  const end = formatMonth(endDate);
  return `${start} – ${end ?? "Present"}`;
}

/** Catégorie → label lisible (repli sur la valeur brute si inconnue). */
export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) {
    return null;
  }
  return CATEGORY_LABELS[category as SkillCategory] ?? category;
}

/** Preuves « experience #0, project #2 » ; « bio » sans index (candidat v3). */
export function evidenceLabel(
  evidence:
    | readonly { source?: string | null; index?: number | null }[]
    | null
    | undefined,
): string | null {
  if (!evidence || evidence.length === 0) {
    return null;
  }
  return evidence
    .map((item) =>
      item.index == null
        ? (item.source ?? "?")
        : `${item.source ?? "?"} #${item.index}`,
    )
    .join(", ");
}

export const NORMALIZED_MUTED = "text-body-sm font-body-sm text-text-secondary";
export const NORMALIZED_BLOCK_TITLE =
  "font-label-md text-label-md text-text-secondary uppercase tracking-wider";
export const NORMALIZED_ITEM_CARD = "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
