"use client";

import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import {
  type BoardSelection,
  NO_SELECTION,
  toPublicJobFilters,
} from "@/features/job-offer/public-jobs-filters";
import { PublicJobsResults } from "@/features/job-offer/public-jobs-results";
import { PublicJobsToolbar } from "@/features/job-offer/public-jobs-toolbar";
import { publicJobPath } from "@/features/job-offer/job-offer-shared";
import { OFFER_SEARCH_MAX_LENGTH } from "@/features/job-offer/offer-filter-controls";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHeaderSearch } from "@/hooks/use-header-search";
import { useInfinitePublicJobs } from "@/hooks/use-public-jobs";
import type { HeaderSearchRole } from "@/stores/header-search-store";
import type { PublicJobSort } from "@/types/public-job";

/** Rôle du champ de recherche du header sur le board : titre ou société de l'offre. */
const BOARD_SEARCH_ROLE: HeaderSearchRole = {
  id: "job-board",
  label: "Search jobs",
  placeholder: "Search by job title or company",
  maxLength: OFFER_SEARCH_MAX_LENGTH,
};

/**
 * Job board (T-72, intégré au shell dashboard en T-74, refonte cartes T-76,
 * recherche, filtres et tri T-77) : offres publiées non expirées, flux en
 * grille deux colonnes ≥ xl et chargement automatique en bas de liste
 * (`InfiniteList`) — la taille de page est décidée par le backend (D34).
 *
 * La recherche vit dans le **header** du dashboard (D89) ; la vitrine
 * publique `/public/jobs` (D100/T-113) a sa propre page, même moteur et
 * mêmes filtres.
 */
export function PublicJobsView() {
  const [search, setSearch] = useHeaderSearch(BOARD_SEARCH_ROLE);
  const [selection, setSelection] = useState<BoardSelection>(NO_SELECTION);
  const [sort, setSort] = useState<PublicJobSort>("recent");
  const debouncedSearch = useDebouncedValue(search, 300);
  const filters = toPublicJobFilters(debouncedSearch, selection, sort);
  const query = useInfinitePublicJobs(filters);
  const jobs = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  // Le tri seul n'est pas un filtre : il ne change pas le message d'état vide.
  const filtered = Object.keys(filters).some((key) => key !== "sort");
  const hasActiveControls =
    search.trim() !== "" || Object.values(selection).some(Boolean) || sort !== "recent";
  const select = (patch: Partial<BoardSelection>) =>
    setSelection((current) => ({ ...current, ...patch }));
  const resetFilters = () => {
    setSearch("");
    setSelection(NO_SELECTION);
    setSort("recent");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        as="header"
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/dashboard">Candidate space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Browse offers</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Open positions"
      />

      <div className="w-full flex flex-col gap-4">
        <PublicJobsToolbar
          selection={selection}
          onChange={select}
          sort={sort}
          onSortChange={setSort}
          onReset={resetFilters}
          hasActiveControls={hasActiveControls}
        />

        <PublicJobsResults
          jobs={jobs}
          total={total}
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          filtered={filtered}
          onReset={resetFilters}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
          jobPath={(job) => publicJobPath(job.publicId, job.slug)}
          applyPath={(job) => `${publicJobPath(job.publicId, job.slug)}/apply`}
        />
      </div>
    </div>
  );
}
