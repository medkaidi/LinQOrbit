"use client";

import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { InfiniteList } from "@/components/ui/infinite-list";
import { Spinner } from "@/components/ui/spinner";
import { RetryButton } from "@/features/admin/retry-button";
import { JobOfferCard } from "@/features/job-offer/job-offer-card";
import { isOfferExpired } from "@/features/job-offer/job-offer-shared";
import {
  EXPIRY_FILTER_OPTIONS,
  FilterSelect,
  NO_OFFER_FILTERS,
  OFFER_SEARCH_MAX_LENGTH,
  ResetFiltersButton,
  SENIORITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  toJobOfferFilters,
  vocabularyOptions,
  type OfferFilterState,
} from "@/features/job-offer/offer-filter-controls";
import { useInfiniteAdminJobOffers } from "@/hooks/use-admin";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHeaderSearch } from "@/hooks/use-header-search";
import { useContractTypes, useEmploymentTypes, useWorkModes } from "@/hooks/use-job-offers";
import type { HeaderSearchRole } from "@/stores/header-search-store";
import type { AdminJobOfferListItem } from "@/types/admin";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

/** Rôle du champ de recherche du header sur la liste des offres (T-110, D96) : titre ou société. */
const ADMIN_OFFERS_SEARCH_ROLE: HeaderSearchRole = {
  id: "admin-offers",
  label: "Search offers",
  placeholder: "Search by title or company",
  maxLength: OFFER_SEARCH_MAX_LENGTH,
};

/** Console en lecture seule (D33/D38) : la carte partage la présentation recruteur, une seule action « View ». */
function OfferRow({
  offer,
  contractTypeLabel,
  workModeLabel,
}: {
  offer: AdminJobOfferListItem;
  contractTypeLabel: string | null;
  workModeLabel: string | null;
}) {
  return (
    <JobOfferCard
      status={offer.status}
      title={offer.title}
      titleHref={`/admin/offers/${offer.id}`}
      companyName={offer.companyName}
      seniority={offer.seniority}
      city={offer.city}
      country={offer.country}
      workModeLabel={workModeLabel}
      contractTypeLabel={contractTypeLabel}
      salaryMin={offer.salaryMin}
      salaryMax={offer.salaryMax}
      salaryCurrency={offer.salaryCurrency}
      salaryPeriod={offer.salaryPeriod}
      expired={isOfferExpired(offer)}
      normalization={
        offer.normalizationJobStatus === "pending" || offer.normalizationJobStatus === "running"
          ? "progress"
          : offer.normalizationJobStatus === "failed"
            ? "failed"
            : null
      }
      unvalidatedChanges={offer.hasUnvalidatedChanges}
      createdAt={offer.createdAt}
      updatedAt={offer.updatedAt}
      expiresAt={offer.expiresAt}
      actions={
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ButtonLink href={`/admin/offers/${offer.id}`} variant="outline-sm">
            View
          </ButtonLink>
        </div>
      }
    />
  );
}

/**
 * Liste globale de toutes les offres du système (D33) : recherche dans le
 * header (titre ou société) + filtres de la liste recruteur (T-110, D96) +
 * infinite scroll (D34).
 */
export function AdminOffersSection() {
  const [search, setSearch] = useHeaderSearch(ADMIN_OFFERS_SEARCH_ROLE);
  const [selected, setSelected] = useState<OfferFilterState>(NO_OFFER_FILTERS);
  const debouncedSearch = useDebouncedValue(search, 300);
  const filters = toJobOfferFilters(debouncedSearch, selected);
  const offers = useInfiniteAdminJobOffers(filters);
  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();
  const workModes = useWorkModes();
  const select = (patch: Partial<OfferFilterState>) =>
    setSelected((current) => ({ ...current, ...patch }));
  const resetFilters = () => {
    setSearch("");
    setSelected(NO_OFFER_FILTERS);
  };
  const filtered = Object.keys(filters).length > 0;
  const hasActiveControls = search.trim() !== "" || Object.values(selected).some(Boolean);
  const items = offers.data?.pages.flatMap((page) => page.items) ?? [];
  const total = offers.data?.pages[0]?.total ?? 0;
  const contractLabels = new Map(
    (contractTypes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  const workModeLabels = new Map(
    (workModes.data ?? []).map((option) => [option.id, option.label] as const),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Job offers</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Job offers"
        action={
          <div className="flex flex-wrap items-center gap-3">
            {offers.data && (
              <span className={`${MUTED} shrink-0`}>
                {total} {total === 1 ? "offer" : "offers"}
              </span>
            )}
          </div>
        }
      />
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              stacked
              label="Status"
              options={STATUS_FILTER_OPTIONS}
              value={selected.status}
              onChange={(value) => select({ status: value as OfferFilterState["status"] })}
            />
            <FilterSelect
              stacked
              label="Work mode"
              options={vocabularyOptions(workModes.data)}
              value={selected.workModeId}
              onChange={(value) => select({ workModeId: value })}
            />
            <FilterSelect
              stacked
              label="Contract"
              options={vocabularyOptions(contractTypes.data)}
              value={selected.contractTypeId}
              onChange={(value) => select({ contractTypeId: value })}
            />
            <FilterSelect
              stacked
              label="Employment"
              options={vocabularyOptions(employmentTypes.data)}
              value={selected.employmentTypeId}
              onChange={(value) => select({ employmentTypeId: value })}
            />
            <FilterSelect
              stacked
              label="Seniority"
              options={SENIORITY_FILTER_OPTIONS}
              value={selected.seniority}
              onChange={(value) => select({ seniority: value as OfferFilterState["seniority"] })}
            />
            <FilterSelect
              stacked
              label="Deadline"
              options={EXPIRY_FILTER_OPTIONS}
              value={selected.expiry}
              onChange={(value) => select({ expiry: value as OfferFilterState["expiry"] })}
            />
            {hasActiveControls ? (
              <div className="shrink-0">
                <ResetFiltersButton onClick={resetFilters} />
              </div>
            ) : null}
          </div>
          {offers.isError && (
            <Alert variant="error" title="Unable to load offers">
              <RetryButton onRetry={() => void offers.refetch()} label="Try again" />
            </Alert>
          )}
          {offers.isLoading && (
            <p className="flex items-center gap-2 text-body-sm text-text-secondary">
              <Spinner />
              Loading offers…
            </p>
          )}
          <InfiniteList
            items={items}
            keyExtractor={(offer) => offer.id}
            renderItem={(offer) => (
              <OfferRow
                offer={offer}
                contractTypeLabel={
                  offer.contractTypeId ? contractLabels.get(offer.contractTypeId) ?? null : null
                }
                workModeLabel={
                  offer.workModeId ? workModeLabels.get(offer.workModeId) ?? null : null
                }
              />
            )}
            hasNextPage={offers.hasNextPage}
            isFetchingNextPage={offers.isFetchingNextPage}
            fetchNextPage={() => void offers.fetchNextPage()}
            loading={offers.isLoading}
            empty={
              filtered ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className={MUTED}>No offers match your filters.</p>
                  <ResetFiltersButton onClick={resetFilters} />
                </div>
              ) : (
                <p className={MUTED}>No offers yet.</p>
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
