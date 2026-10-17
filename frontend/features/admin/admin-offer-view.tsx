"use client";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { OfferStatusPill } from "@/features/job-offer/job-offer-card";
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
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href="/admin/offers">Job offers</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>{data.detail.title}</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title={data.detail.title}
        action={
          <div className="flex items-center gap-3 shrink-0">
            <OfferStatusPill status={data.status} />
            {data.detail.expiresAt && (
              <span className={MUTED}>expires {data.detail.expiresAt.slice(0, 10)}</span>
            )}
          </div>
        }
      />

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
