"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfiniteList } from "@/components/ui/infinite-list";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import {
  ADMIN_OFFER_STATUS_TONES,
  adminOfferStatusLabel,
} from "@/features/admin/admin-offer-status";
import { RetryButton } from "@/features/admin/retry-button";
import { useInfiniteAdminJobOffers } from "@/hooks/use-admin";
import type { AdminJobOfferListItem, AdminJobOfferStatus } from "@/types/admin";

const SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-border";
const SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
const ITEM_CARD = "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
const MUTED = "text-body-sm font-body-sm text-text-secondary";

type StatusFilter = AdminJobOfferStatus | undefined;

const FILTER_OPTIONS: SegmentedOption<"all" | AdminJobOfferStatus>[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

function OfferRow({ offer }: { offer: AdminJobOfferListItem }) {
  return (
    <li className={`${ITEM_CARD} flex flex-wrap items-center justify-between gap-4`}>
      <div className="min-w-0">
        <p className="text-body-md font-body-md text-text-primary font-semibold truncate">
          <Link
            href={`/admin/offers/${offer.id}`}
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            {offer.title}
          </Link>
        </p>
        <p className={`${MUTED} truncate`}>
          {offer.companyName || "No company"}
          {offer.publishedAt ? ` · published ${offer.publishedAt.slice(0, 10)}` : ""}
          {` · updated ${offer.updatedAt.slice(0, 10)}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge tone={ADMIN_OFFER_STATUS_TONES[offer.status]}>
          {adminOfferStatusLabel(offer.status)}
        </Badge>
        <Link
          href={`/admin/offers/${offer.id}`}
          className={`${MUTED} hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep`}
        >
          View
        </Link>
      </div>
    </li>
  );
}

/** Liste globale de toutes les offres du système (D33) : filtre + infinite scroll (D34). */
export function AdminOffersSection() {
  const [filter, setFilter] = useState<"all" | AdminJobOfferStatus>("all");
  const status: StatusFilter = filter === "all" ? undefined : filter;
  const offers = useInfiniteAdminJobOffers(status);
  const items = offers.data?.pages.flatMap((page) => page.items) ?? [];
  const total = offers.data?.pages[0]?.total ?? 0;

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
          renderItem={(offer) => <OfferRow offer={offer} />}
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
