import { Badge } from "@/components/ui/badge";
import {
  categoryLabel,
  evidenceLabel,
  NORMALIZED_ITEM_CARD,
  NORMALIZED_MUTED,
} from "@/features/admin/normalized/normalized-shared";

/** Shape commune candidat v3 / offre v2 — champs absents tolérés (TD-028). */
export type NormalizedSkillRowModel = {
  name?: string;
  level?: number | null;
  /** Poids 1-5 (offre uniquement : le candidat n'en porte pas). */
  weight?: number | null;
  origin?: string | null;
  category?: string | null;
  /** Années côté candidat (« 8 yrs »), dans la ligne de meta. */
  yearsExperience?: number | null;
  /** Années minimales côté offre (« 5+ yrs »), dans l'en-tête. */
  minYears?: number | null;
  minYearsSource?: string | null;
  evidence?: readonly { source?: string | null; index?: number | null }[] | null;
};

/** Ligne de compétence unique des deux vues normalisées (candidat + offre). */
export function NormalizedSkillRow({ skill }: { skill: NormalizedSkillRowModel }) {
  const evidence = evidenceLabel(skill.evidence);
  const meta = [
    categoryLabel(skill.category),
    skill.yearsExperience != null ? `${skill.yearsExperience} yrs` : null,
    evidence ? `Evidence: ${evidence}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={NORMALIZED_ITEM_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-md font-body-md text-text-primary font-semibold">
          {skill.name ?? "Unnamed skill"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {skill.weight != null && (
            <span className={NORMALIZED_MUTED}>Weight {skill.weight}/5</span>
          )}
          {skill.level != null && (
            <span className={NORMALIZED_MUTED}>Level {skill.level}/5</span>
          )}
          {skill.minYears != null && (
            <span className={NORMALIZED_MUTED}>
              {skill.minYears}+ yrs
              {skill.minYearsSource === "inferred" ? " (inferred)" : ""}
            </span>
          )}
          <Badge tone={skill.origin === "inferred" ? "neutral" : "success"}>
            {skill.origin === "inferred" ? "Inferred" : "Declared"}
          </Badge>
        </div>
      </div>
      {meta && <p className={`${NORMALIZED_MUTED} mt-1`}>{meta}</p>}
    </li>
  );
}
