"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_OFFER_STATUS_TONES,
  adminOfferStatusLabel,
} from "@/features/admin/admin-offer-status";
import { NormalizedOfferView } from "@/features/admin/normalized/normalized-offer-view";
import { NormalizedProfileSection } from "@/features/admin/normalized/normalized-profile-section";
import { RetryButton } from "@/features/admin/retry-button";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import { toPublicJobArticleModel } from "@/features/job-offer/job-offer-shared";
import { useAdminJobOffer, useAdminOfferNormalized } from "@/hooks/use-admin";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

/**
 * Détail d'une offre côté admin (D33) : statut de vie + fiche publique
 * (labels résolus, HTML sanitisé) sans gate published/expirée, + fiche
 * normalisée friendly.
 */
export function AdminOfferDetailView({ offerId }: { offerId: string }) {
  const offer = useAdminJobOffer(offerId);
  const normalized = useAdminOfferNormalized(offerId);

  if (offer.isLoading) {
    return <p className={MUTED}>Loading offer…</p>;
  }

  if (offer.isError || !offer.data) {
    return (
      <Alert variant="error" title="Unable to load the offer">
        The offer could not be loaded.{" "}
        <RetryButton onRetry={() => void offer.refetch()} label="Try again" />
      </Alert>
    );
  }

  const data = offer.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
        >
          <Link
            href="/admin"
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            Administration
          </Link>
          <span aria-hidden="true" className="text-text-tertiary">
            /
          </span>
          <Link
            href="/admin/offers"
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            Job offers
          </Link>
          <span aria-hidden="true" className="text-text-tertiary">
            /
          </span>
          <span className="text-text-primary font-semibold">{data.detail.title}</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight min-w-0">
            {data.detail.title}
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            <Badge tone={ADMIN_OFFER_STATUS_TONES[data.status]}>
              {adminOfferStatusLabel(data.status)}
            </Badge>
            {data.detail.expiresAt && (
              <span className={MUTED}>expires {data.detail.expiresAt.slice(0, 10)}</span>
            )}
          </div>
        </div>
      </div>

      <PublicJobArticle article={toPublicJobArticleModel(data.detail)} />

      <NormalizedProfileSection
        isLoading={normalized.isLoading}
        isError={normalized.isError}
        error={normalized.error}
        profile={normalized.data}
        onRetry={() => void normalized.refetch()}
      >
        {(content) => <NormalizedOfferView offer={content} />}
      </NormalizedProfileSection>
    </div>
  );
}
