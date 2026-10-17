import type { ReactNode } from "react";

import { OriginBadge } from "@/features/admin/normalized/normalized-origin-badge";
import {
  categoryLabel,
  evidenceLabel,
} from "@/features/admin/normalized/normalized-shared";

/** Champs de compétence communs aux deux fiches normalisées (candidat v3 / offre v2). */
type SkillsTableSkill = {
  name?: string | null;
  category?: string | null;
  origin?: string | null;
  evidence?:
    | readonly { source?: string | null; index?: number | null }[]
    | null;
};

type SkillsTableRow = {
  skill: SkillsTableSkill;
  /** Cellules propres à la vue, insérées entre les cellules Skill et Evidence. */
  cells: ReactNode;
};

/**
 * Tableau de compétences des fiches normalisées (candidat / offre) — même
 * anatomie de tableau et mêmes cellules Skill/Evidence/Origin ; seules les
 * colonnes du milieu et la largeur minimale varient par vue (TD-028).
 * Tolère tout champ absent (fiches v1) — cellules « — ».
 */
export function SkillsTable({
  columns,
  minWidthClass,
  rows,
}: {
  columns: string[];
  minWidthClass: string;
  rows: SkillsTableRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidthClass} text-left border-collapse`}>
        <thead>
          <tr className="border-b border-slate-border">
            {columns.map((column) => (
              <th
                key={column}
                className="py-2.5 pr-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-border text-body-sm font-body-sm">
          {rows.map(({ skill, cells }, index) => {
            const evidence = evidenceLabel(skill.evidence);
            const category = categoryLabel(skill.category);
            return (
              <tr key={index} className="hover:bg-item-surface/50 transition-colors">
                <td className="py-3 pr-3 min-w-40">
                  <span className="block font-semibold text-text-primary">
                    {skill.name ?? "Unnamed skill"}
                  </span>
                  {category && <span className="block text-text-secondary">{category}</span>}
                </td>
                {cells}
                <td className="py-3 pr-3 text-text-secondary">{evidence ?? "—"}</td>
                <td className="py-3 pr-3">
                  {skill.origin ? (
                    <OriginBadge origin={skill.origin} />
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
