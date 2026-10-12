"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JobOfferForm } from "@/features/job-offer/job-offer-form";
import { STATUS_LABELS } from "@/features/job-offer/job-offer-shared";
import { useJobOffer } from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";

/**
 * Édition d'offre : uniquement en DRAFT ou VALIDATED (D13) — un statut
 * PUBLISHED/CLOSED renvoie au workspace (le backend refuserait de toute façon).
 * La company porteuse de l'offre est figée : le sélecteur (et donc le fetch
 * des companies) n'existe qu'en mode create.
 */
export function JobOfferEdit({ offerId }: { offerId: string }) {
  const router = useRouter();
  const offer = useJobOffer(offerId);

  const data = offer.data;
  const readOnlyStatus = data ? data.status === "published" || data.status === "closed" : false;

  useEffect(() => {
    if (readOnlyStatus) {
      router.replace("/recruiter");
    }
  }, [readOnlyStatus, router]);

  if (offer.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pb-6 border-b border-slate-border">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Edit job offer
          </h1>
        </div>
        <div className="flex items-center gap-2 text-body-sm text-text-secondary">
          <Spinner />
          Loading…
        </div>
      </div>
    );
  }

  if (offer.isError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pb-6 border-b border-slate-border">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Edit job offer
          </h1>
        </div>
        <Alert variant="error" title="Could not load the offer">
          <div className="flex items-center justify-between gap-3">
            <span>{getJobOfferErrorMessage(offer.error)}</span>
            <Button variant="outline-sm" onClick={() => router.push("/recruiter")}>
              Back to offers
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!data || readOnlyStatus) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <p className="text-body-sm font-body-sm text-text-secondary">
          {STATUS_LABELS[data.status]}
        </p>
        <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Edit job offer
        </h1>
      </div>
      <JobOfferForm mode="edit" offer={data} companies={[]} />
    </div>
  );
}
