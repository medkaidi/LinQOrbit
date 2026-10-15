"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { InfiniteList } from "@/components/ui/infinite-list";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { RetryButton } from "@/features/admin/retry-button";
import { JobOfferCard, OFFER_LINK_PILL_CLASS } from "@/features/job-offer/job-offer-card";
import { isOfferExpired } from "@/features/job-offer/job-offer-shared";
import { useInfiniteAdminJobOffers } from "@/hooks/use-admin";
import { useContractTypes, useWorkModes } from "@/hooks/use-job-offers";
import type { AdminJobOfferListItem, AdminJobOfferStatus } from "@/types/admin";

const SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-border";
const SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
const MUTED = "text-body-sm font-body-sm text-text-secondary";

type StatusFilter = AdminJobOfferStatus | undefined;

const FILTER_OPTIONS: SegmentedOption<"all" | AdminJobOfferStatus>[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

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
      actions={
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link href={`/admin/offers/${offer.id}`} className={OFFER_LINK_PILL_CLASS}>
            View
          </Link>
        </div>
      }
    />
  );
}

/** Liste globale de toutes les offres du système (D33) : filtre + infinite scroll (D34). */
export function AdminOffersSection() {
  const [filter, setFilter] = useState<"all" | AdminJobOfferStatus>("all");
  const status: StatusFilter = filter === "all" ? undefined : filter;
  const offers = useInfiniteAdminJobOffers(status);
  const contractTypes = useContractTypes();
  const workModes = useWorkModes();
  const items = offers.data?.pages.flatMap((page) => page.items) ?? [];
  const total = offers.data?.pages[0]?.total ?? 0;
  const contractLabels = new Map(
    (contractTypes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  const workModeLabels = new Map(
    (workModes.data ?? []).map((option) => [option.id, option.label] as const),
  );

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER}>
        <h2 className={SECTION_TITLE}>Job offers</h2>
        <SegmentedControl
          label="Filter offers by status"
          value={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
        />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        {offers.isError && (
          <Alert variant="error" title="Unable to load offers">
            <RetryButton onRetry={() => void offers.refetch()} label="Try again" />
          </Alert>
        )}
        {offers.isLoading && <p className={MUTED}>Loading offers…</p>}
        {total > 0 && (
          <p className={MUTED}>
            {total} {total === 1 ? "offer" : "offers"}
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
          empty={<p className={MUTED}>No offers match this filter.</p>}
        />
      </div>
    </section>
  );
}
