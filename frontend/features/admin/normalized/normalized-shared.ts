import type {
  NormalizedCandidateProfile,
  NormalizedJobOffer,
  SkillCategory,
} from "@/types/normalized";

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

/** ISO local "2026-10-10T12:00:00" → "2026-10-10 12:00" ; repli valeur brute. */
export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) {
    return value;
  }
  return `${match[1]} ${match[2]}`;
}

/**
 * Stats réelles de la fiche (rail latéral) : provenance declared/inferred sur
 * les entrées qui en portent une, + couverture des sections (nombre d'entrées).
 * Aucune donnée inventée — les compteurs reflètent strictement le contenu.
 */
export type SheetStats = {
  provenance: { declared: number; inferred: number; total: number };
  coverage: { label: string; count: number }[];
};

function countOrigins(
  entries: readonly { origin?: string | null }[] | undefined,
): SheetStats["provenance"] {
  let declared = 0;
  let inferred = 0;
  for (const entry of entries ?? []) {
    if (entry.origin === "declared") {
      declared += 1;
    } else if (entry.origin === "inferred") {
      inferred += 1;
    }
  }
  return { declared, inferred, total: declared + inferred };
}

/** Provenance + couverture d'une fiche candidat (skills/langues/credentials portent l'origin). */
export function candidateSheetStats(profile: NormalizedCandidateProfile): SheetStats {
  return {
    provenance: countOrigins([
      ...(profile.skills ?? []),
      ...(profile.languages ?? []),
      ...(profile.diplomas ?? []),
      ...(profile.certifications ?? []),
    ]),
    coverage: [
      { label: "Skills", count: (profile.skills ?? []).length },
      { label: "Experience", count: (profile.experiences ?? []).length },
      { label: "Projects", count: (profile.projects ?? []).length },
      { label: "Education", count: (profile.diplomas ?? []).length },
      { label: "Languages", count: (profile.languages ?? []).length },
      { label: "Certifications", count: (profile.certifications ?? []).length },
      { label: "Links", count: (profile.links ?? []).length },
    ],
  };
}

/** Provenance + couverture d'une fiche offre (skills/langues portent l'origin, exigences éducation le source). */
export function offerSheetStats(offer: NormalizedJobOffer): SheetStats {
  const skills = [...(offer.requiredSkills ?? []), ...(offer.preferredSkills ?? [])];
  return {
    provenance: countOrigins([
      ...skills,
      ...(offer.languages ?? []),
      ...(offer.requiredDegrees ?? []).map((entry) => ({ origin: entry.source })),
      ...(offer.requiredStudyFields ?? []).map((entry) => ({ origin: entry.source })),
    ]),
    coverage: [
      { label: "Skills", count: skills.length },
      { label: "Responsibilities", count: (offer.responsibilities ?? []).length },
      { label: "Experience", count: offer.requiredYears != null ? 1 : 0 },
      {
        label: "Education",
        count:
          (offer.requiredDegrees ?? []).length + (offer.requiredStudyFields ?? []).length,
      },
      { label: "Languages", count: (offer.languages ?? []).length },
      { label: "Certifications", count: (offer.certifications ?? []).length },
      { label: "Benefits", count: (offer.benefits ?? []).length },
    ],
  };
}

export const NORMALIZED_MUTED = "text-body-sm font-body-sm text-text-secondary";
export const NORMALIZED_BLOCK_TITLE =
  "font-label-md text-label-md text-text-secondary uppercase tracking-wider";
export const NORMALIZED_ITEM_CARD =
  "rounded-md border border-slate-border bg-item-surface/50 p-3.5";

/**
 * Largeur du drawer normalisé = **50 % du contenu hors sidenav** (décision
 * 2026-10-15), bornée à 560 px minimum pour rester lisible. La sidenav est
 * repliable (256 px ↔ 80 px) : sa largeur vit dans `--sidenav-w`, posée sur
 * `<html>` par `AdminShell`. `SHEET_HALF_WIDTH` (panneau, portailé) et
 * `SHEET_HALF_PAD` (padding miroir des 2 pages détail) doivent rester en
 * parfait écho — sinon la source passe sous le drawer ou laisse un trou.
 * Espaces en `_` (valeur arbitraire Tailwind).
 */
export const SHEET_HALF_WIDTH =
  "lg:w-[max(560px,calc((100vw_-_var(--sidenav-w))/2))]";
export const SHEET_HALF_PAD =
  "lg:pr-[max(560px,calc((100vw_-_var(--sidenav-w))/2))]";
