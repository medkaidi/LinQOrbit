"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { JobOfferForm } from "@/features/job-offer/job-offer-form";
import { useCompanies } from "@/hooks/use-recruiter";

/**
 * Création d'offre : s'appuie sur la première company du recruteur (le choix
 * multi-company apparaît dans le formulaire quand il y en a plusieurs) ; sans
 * company, retour au workspace où le setup prend le relais (D16).
 */
export function JobOfferNew() {
  const router = useRouter();
  const companies = useCompanies();
  const list = companies.data ?? [];
  const ready = !companies.isLoading && !companies.isError;

  useEffect(() => {
    if (ready && list.length === 0) {
      router.replace("/recruiter");
    }
  }, [ready, list.length, router]);

  if (companies.isLoading || companies.isError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pb-6 border-b border-slate-border">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            New job offer
          </h1>
        </div>
        {companies.isError ? (
          <Alert variant="error" title="Could not load your companies">
            Retry by going back to the recruiter workspace.
          </Alert>
        ) : (
          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </div>
        )}
      </div>
    );
  }

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          New job offer
        </h1>
      </div>
      <JobOfferForm mode="create" companies={list} />
    </div>
  );
}
