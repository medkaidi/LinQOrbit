"use client";

import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { SENIORITY_LABELS } from "@/features/job-offer/job-offer-shared";
import type {
  JobOfferExpiryFilter,
  JobOfferFilters,
  JobOfferLabelOption,
  JobOfferStatusValue,
  SeniorityValue,
} from "@/types/recruiter";

/** Valeur de l'option « All » : filtre vide ≡ absent (aucune clé envoyée). */
const ALL_VALUE = "";

/** Plafond de saisie de la recherche : miroir du plafond serveur (100 caractères). */
export const OFFER_SEARCH_MAX_LENGTH = 100;

export const SENIORITY_FILTER_OPTIONS: SelectOption[] = (
  Object.keys(SENIORITY_LABELS) as SeniorityValue[]
).map((value) => ({ value, label: SENIORITY_LABELS[value] }));

export const STATUS_FILTER_OPTIONS: { value: JobOfferStatusValue; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

export const EXPIRY_FILTER_OPTIONS: { value: JobOfferExpiryFilter; label: string }[] = [
  { value: "expiringSoon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
];

/** Sélections brutes de la toolbar : "" = « All » (aucun filtre). */
export type OfferFilterState = {
  status: "" | JobOfferStatusValue;
  workModeId: string;
  contractTypeId: string;
  employmentTypeId: string;
  seniority: "" | SeniorityValue;
  companyId: string;
  expiry: "" | JobOfferExpiryFilter;
};

export const NO_OFFER_FILTERS: OfferFilterState = {
  status: "",
  workModeId: "",
  contractTypeId: "",
  employmentTypeId: "",
  seniority: "",
  companyId: "",
  expiry: "",
};

/** État de la toolbar → filtres d'API : une sélection vide n'est jamais envoyée. */
export function toJobOfferFilters(search: string, selected: OfferFilterState): JobOfferFilters {
  const q = search.trim();
  return {
    ...(q ? { q } : {}),
    ...(selected.status ? { status: selected.status } : {}),
    ...(selected.workModeId ? { workModeId: selected.workModeId } : {}),
    ...(selected.contractTypeId ? { contractTypeId: selected.contractTypeId } : {}),
    ...(selected.employmentTypeId ? { employmentTypeId: selected.employmentTypeId } : {}),
    ...(selected.seniority ? { seniority: selected.seniority } : {}),
    ...(selected.companyId ? { companyId: selected.companyId } : {}),
    ...(selected.expiry ? { expiry: selected.expiry } : {}),
  };
}

/** Vocabulaire `{id, label}` du backend → options de sélecteur. */
export function vocabularyOptions(
  vocabulary: JobOfferLabelOption[] | undefined,
): SelectOption[] {
  return (vocabulary ?? []).map((option) => ({ value: option.id, label: option.label }));
}

/**
 * Sélecteur de filtre compact d'une toolbar d'offres, option « All » en tête
 * (vide = filtre absent). Par défaut le libellé est en ligne et le déclencheur
 * prend la largeur de sa valeur ; `stacked` met le libellé au-dessus et laisse
 * le déclencheur remplir sa cellule — de grille (board) ou de rangée repliable
 * (`flex-1 basis-32`, liste recruteur) : la valeur ne dépend plus de la place que
 * laisse le libellé.
 */
export function FilterSelect({
  label,
  options,
  value,
  onChange,
  searchable = false,
  stacked = false,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "min-w-0 flex-1 basis-32" : "min-w-0"}>
      <Select
        label={label}
        compact
        inlineLabel={!stacked}
        searchable={searchable}
        options={[{ value: ALL_VALUE, label: "All" }, ...options]}
        value={value}
        onValueChange={onChange}
      />
    </div>
  );
}

/** Remise à zéro des filtres : n'apparaît que lorsqu'un filtre est actif. */
export function ResetFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline-sm" onClick={onClick}>
      Reset
    </Button>
  );
}
