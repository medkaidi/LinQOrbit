"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Icon } from "@/components/ui/icon";
import { publicJobPath } from "@/features/job-offer/job-offer-shared";
import { OFFER_SEARCH_MAX_LENGTH } from "@/features/job-offer/offer-filter-controls";
import {
  type BoardSelection,
  NO_SELECTION,
  toPublicJobFilters,
} from "@/features/job-offer/public-jobs-filters";
import { PublicJobsResults } from "@/features/job-offer/public-jobs-results";
import { PublicJobsToolbar } from "@/features/job-offer/public-jobs-toolbar";
import { PageHero } from "@/features/marketing/page-hero";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfinitePublicJobs } from "@/hooks/use-public-jobs";
import type { PublicJobSort } from "@/types/public-job";

/** Base de la fiche dans la vitrine publique (le board authentifié garde `/jobs`). */
const JOB_BASE_PATH = "/public/jobs";

/**
 * Vitrine publique des offres (D100/T-113) : la même liste que le board
 * authentifié `/jobs` — mêmes filtres, même tri, même moteur — mais dans le
 * shell public, **sans compte** et avec sa propre recherche (le board
 * dashboard prend la sienne dans son header, D89).
 *
 * Les liens ouvrent la fiche publique `/public/jobs/{publicId}-{slug}` ; le
 * CTA « Apply » mène au parcours de candidature, qui reste authentifié
 * (l'AuthGate renvoie vers le login avec retour).
 */
export function PublicJobsDirectory({ initialQuery }: { initialQuery: string }) {
  const [search, setSearch] = useState(initialQuery);
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    // La liste se met à jour à la frappe (debounce 300 ms) : le formulaire
    // sert de point d'entrée accessible (label, touche Entrée), pas de
    // navigation.
    event.preventDefault();
  };

  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Open positions"
        title={
          <>
            Job offers published on <span className="text-orange-deep">LinQOrbit</span>
          </>
        }
        lede="Every offer is structured, analyzed by AI and scored criterion by criterion. Browse them without an account — creating one is free and lets you apply."
        actions={
          <>
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-canvas-white font-label-lg text-label-lg hover:bg-orange-deep transition-all duration-150 shadow-sm flex items-center justify-center gap-2"
            >
              <span>Create your account</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
            <Link
              href="/login"
              className="font-label-lg text-label-lg text-text-secondary hover:text-slate-ink font-medium tracking-tight transition-colors"
            >
              Sign in
            </Link>
          </>
        }
      />

      <section className="max-w-7xl mx-auto px-gutter pb-24 w-full">
        <div className="flex flex-col gap-4">
          <form
            onSubmit={submit}
            role="search"
            className="w-full bg-canvas-white border border-slate-border rounded-full p-2 flex items-center shadow-sm"
          >
            <div className="flex-1 flex items-center px-4 py-2 gap-3">
              <Icon name="search" className="text-text-tertiary text-[22px]" />
              <div className="flex-1 text-left">
                <label htmlFor="public-jobs-search" className="sr-only">
                  Search by job title or company
                </label>
                <input
                  id="public-jobs-search"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={OFFER_SEARCH_MAX_LENGTH}
                  placeholder="Search by job title or company"
                  className="w-full bg-transparent font-headline-sm text-headline-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>
          </form>

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
            jobPath={(job) => publicJobPath(job.publicId, job.slug, JOB_BASE_PATH)}
            applyPath={(job) => `${publicJobPath(job.publicId, job.slug)}/apply`}
          />
        </div>
      </section>
    </div>
  );
}
