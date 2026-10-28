import type { PublicJobFilters, PublicJobSort } from "@/types/public-job";
import type { SeniorityValue } from "@/types/recruiter";

/** Sélections brutes de la toolbar : "" = « All » (aucun filtre). */
export type BoardSelection = {
  workModeId: string;
  contractTypeId: string;
  employmentTypeId: string;
  seniority: "" | SeniorityValue;
  country: string;
};

export const NO_SELECTION: BoardSelection = {
  workModeId: "",
  contractTypeId: "",
  employmentTypeId: "",
  seniority: "",
  country: "",
};

export const SORT_OPTIONS: { value: PublicJobSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "expiringSoon", label: "Expiring soon" },
];

/**
 * État de la toolbar → filtres d'API : une sélection vide n'est jamais
 * envoyée, et le tri par défaut (« recent ») non plus.
 */
export function toPublicJobFilters(
  search: string,
  selection: BoardSelection,
  sort: PublicJobSort,
): PublicJobFilters {
  const q = search.trim();
  return {
    ...(q ? { q } : {}),
    ...(selection.workModeId ? { workModeId: selection.workModeId } : {}),
    ...(selection.contractTypeId ? { contractTypeId: selection.contractTypeId } : {}),
    ...(selection.employmentTypeId ? { employmentTypeId: selection.employmentTypeId } : {}),
    ...(selection.seniority ? { seniority: selection.seniority } : {}),
    ...(selection.country ? { country: selection.country } : {}),
    ...(sort !== "recent" ? { sort } : {}),
  };
}
