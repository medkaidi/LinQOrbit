"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_OFFER_STATUS_TONES,
  adminOfferStatusLabel,
} from "@/features/admin/admin-offer-status";
import { AdminOfferSourceView } from "@/features/admin/admin-offer-source-view";
import { NormalizedSheetCta } from "@/features/admin/normalized/normalized-sheet-cta";
import { NormalizedSheetDrawer } from "@/features/admin/normalized/normalized-sheet-drawer";
import { SHEET_HALF_PAD } from "@/features/admin/normalized/normalized-shared";
import { RetryButton } from "@/features/admin/retry-button";
import { useAdminJobOffer, useAdminOfferNormalized } from "@/hooks/use-admin";
import { useSheetQueryParam } from "@/hooks/use-sheet-query-param";
import { cn } from "@/lib/utils/cn";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

/**
 * Détail d'une offre côté admin (D33) : statut de vie + vue source de
 * l'offre stockée (D38, labels résolus, HTML sanitisé — remplace la fiche
 * publique) sans gate published/expirée, + carte CTA ouvrant le drawer de
 * comparaison de la fiche normalisée (D37/D39).
 */
export function AdminOfferDetailView({ offerId }: { offerId: string }) {
  const offer = useAdminJobOffer(offerId);
  const normalized = useAdminOfferNormalized(offerId);
  const [sheetOpen, setSheetOpen] = useSheetQueryParam();

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
    <div
      className={cn(
        "flex flex-col gap-6",
        // Drawer ouvert (D39) : le contenu se réduit à la zone visible —
        // jamais recouvert par le panneau fixed.
        sheetOpen && SHEET_HALF_PAD,
      )}
    >
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

      {/* CTA remonté juste sous le h1, avant la ligne company (retour UI). */}
      <NormalizedSheetCta
        isLoading={normalized.isLoading}
        isError={normalized.isError}
        error={normalized.error}
        profile={normalized.data}
        onRetry={() => void normalized.refetch()}
        onOpen={() => setSheetOpen(true)}
      />

      <AdminOfferSourceView job={data.detail} />
      {sheetOpen && (
        <NormalizedSheetDrawer
          kind="offer"
          id={offerId}
          entityLabel={data.detail.title}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
