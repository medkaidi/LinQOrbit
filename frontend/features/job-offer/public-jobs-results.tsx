"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfiniteList } from "@/components/ui/infinite-list";
import { Spinner } from "@/components/ui/spinner";
import { PublicJobCard } from "@/features/job-offer/public-job-card";
import { ResetFiltersButton } from "@/features/job-offer/offer-filter-controls";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { PublicJobListItem } from "@/types/public-job";

/**
 * Résultats du job board : états (chargement, erreur, vide) et flux en grille
 * deux colonnes ≥ xl (`InfiniteList`, chargement automatique en bas de
 * liste) — la taille de page est décidée par le backend (D34).
 *
 * Partagé par le board authentifié (`/jobs`) et la vitrine publique
 * (`/public/jobs`, D100/T-113) : `jobPath` et `applyPath` portent la base de
 * chaque board.
 */
export function PublicJobsResults({
  jobs,
  total,
  isLoading,
  isError,
  error,
  onRetry,
  filtered,
  onReset,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  jobPath,
  applyPath,
}: {
  jobs: PublicJobListItem[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  filtered: boolean;
  onReset: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  jobPath: (job: PublicJobListItem) => string;
  applyPath: (job: PublicJobListItem) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
        <Spinner />
        Loading jobs…
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        variant="error"
        title="Couldn't load offers"
        action={
          <Button variant="outline-sm" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-border bg-canvas-white px-6 py-12 text-center shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-text-primary">
          {filtered ? "No offers match your filters" : "No open positions right now"}
        </h2>
        <p className="mt-2 text-body-sm font-body-sm text-text-secondary">
          {filtered
            ? "Try a different search or remove some filters."
            : "Published offers will show up here as companies open roles."}
        </p>
        {filtered ? (
          <div className="mt-4 flex justify-center">
            <ResetFiltersButton onClick={onReset} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body-sm font-body-sm text-text-tertiary">
        {total} {total === 1 ? "offer" : "offers"}
      </p>
      <InfiniteList
        items={jobs}
        keyExtractor={(job) => job.publicId}
        renderItem={(job) => (
          <PublicJobCard job={job} jobPath={jobPath(job)} applyPath={applyPath(job)} />
        )}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        listClassName="grid grid-cols-1 gap-4 xl:grid-cols-2"
      />
    </div>
  );
}
