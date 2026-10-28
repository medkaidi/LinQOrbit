"use client";

import { Select } from "@/components/ui/select";
import { countryOptions } from "@/config/countries";
import {
  FilterSelect,
  ResetFiltersButton,
  SENIORITY_FILTER_OPTIONS,
  vocabularyOptions,
} from "@/features/job-offer/offer-filter-controls";
import {
  type BoardSelection,
  SORT_OPTIONS,
} from "@/features/job-offer/public-jobs-filters";
import {
  useContractTypes,
  useEmploymentTypes,
  useWorkModes,
} from "@/hooks/use-job-offers";
import type { PublicJobSort } from "@/types/public-job";

/**
 * Barre de filtres du job board — une seule rangée à partir de xl : cinq
 * filtres à parts égales, tri + Reset dans la dernière colonne à la largeur
 * de leur contenu. Partagée par le board authentifié (`/jobs`) et la vitrine
 * publique (`/public/jobs`, D100/T-113) : mêmes filtres, mêmes vocabulaires.
 *
 * La barre reste montée pendant le chargement et en cas d'erreur : sans elle,
 * un échec détruirait les filtres que l'utilisateur vient de saisir.
 */
export function PublicJobsToolbar({
  selection,
  onChange,
  sort,
  onSortChange,
  onReset,
  hasActiveControls,
}: {
  selection: BoardSelection;
  onChange: (patch: Partial<BoardSelection>) => void;
  sort: PublicJobSort;
  onSortChange: (sort: PublicJobSort) => void;
  onReset: () => void;
  hasActiveControls: boolean;
}) {
  const workModes = useWorkModes();
  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();

  return (
    <div className="rounded-2xl border border-slate-border bg-canvas-white p-4 shadow-sm">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <FilterSelect
          stacked
          label="Work mode"
          options={vocabularyOptions(workModes.data)}
          value={selection.workModeId}
          onChange={(value) => onChange({ workModeId: value })}
        />
        <FilterSelect
          stacked
          label="Contract"
          options={vocabularyOptions(contractTypes.data)}
          value={selection.contractTypeId}
          onChange={(value) => onChange({ contractTypeId: value })}
        />
        <FilterSelect
          stacked
          label="Employment"
          options={vocabularyOptions(employmentTypes.data)}
          value={selection.employmentTypeId}
          onChange={(value) => onChange({ employmentTypeId: value })}
        />
        <FilterSelect
          stacked
          label="Seniority"
          options={SENIORITY_FILTER_OPTIONS}
          value={selection.seniority}
          onChange={(value) => onChange({ seniority: value as BoardSelection["seniority"] })}
        />
        <FilterSelect
          stacked
          label="Country"
          searchable
          options={countryOptions}
          value={selection.country}
          onChange={(value) => onChange({ country: value })}
        />
        <div className="flex min-w-0 items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label="Sort by"
              compact
              options={SORT_OPTIONS}
              value={sort}
              onValueChange={(value) => onSortChange(value as PublicJobSort)}
            />
          </div>
          {hasActiveControls ? <ResetFiltersButton onClick={onReset} /> : null}
        </div>
      </div>
    </div>
  );
}
