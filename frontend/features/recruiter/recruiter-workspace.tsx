"use client";

import { useEffect } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CompaniesSection } from "@/features/recruiter/companies-section";
import { CompanySetup } from "@/features/recruiter/company-setup";
import { RecruiterProfileSection } from "@/features/recruiter/profile-section";
import { JobOffersSection } from "@/features/job-offer/job-offers-section";
import { useCreateRecruiter, useRecruiterProfile } from "@/hooks/use-recruiter";
import { useCompanies } from "@/hooks/use-companies";
import { getRecruiterErrorMessage } from "@/lib/api/recruiter.api";

function WorkspaceHeader({ title }: { title: string }) {
  return (
    <PageHeader
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>{title}</BreadcrumbCurrent>
        </Breadcrumb>
      }
      title={title}
    />
  );
}

function SwitchingOverlay() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-[100] bg-canvas-subtle/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="bg-canvas-white rounded-2xl shadow-sm px-8 py-6 flex items-center gap-3">
        <Spinner />
        <p className="text-body-md font-body-md text-text-primary">
          Switching to recruiter workspace…
        </p>
      </div>
    </div>
  );
}

/**
 * Aucun profil recruteur (404) : le modal de bascule (D17) a déjà donné
 * l'information et obtenu le consentement — on crée la ligne ici
 * (POST /me, flux documenté en D16) sans écran intermédiaire, puis le flux
 * reprend (setup company ou workspace). Un 409 (profil créé entre-temps) est
 * absorbé par une invalidation côté hook.
 */
function RecruiterProfileBootstrap({ title }: { title: string }) {
  const create = useCreateRecruiter();

  useEffect(() => {
    if (!create.isPending && !create.isSuccess && !create.isError) {
      create.mutate();
    }
  }, [create]);

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader title={title} />
      {create.isError ? (
        <Alert variant="error" title="Could not start your recruiter workspace">
          <div className="flex items-center justify-between gap-3">
            <span>{getRecruiterErrorMessage(create.error)}</span>
            <Button variant="outline-sm" onClick={() => create.mutate()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : (
        <SwitchingOverlay />
      )}
    </div>
  );
}

/**
 * Espace offres (D16/D17) : vérification du profil recruteur avec overlay
 * « Switching… », 404 → création auto du profil (le modal de bascule a déjà
 * informé), sans company → setup, sinon → offres uniquement (companies et
 * profil vivent dans `/recruiter/settings`).
 */
export function RecruiterWorkspace() {
  const recruiter = useRecruiterProfile();
  const companies = useCompanies();

  if (recruiter.isLoading) {
    return <SwitchingOverlay />;
  }

  if (recruiter.isError) {
    return (
      <div className="flex flex-col gap-6">
        <WorkspaceHeader title="Recruiter workspace" />
        <Alert variant="error" title="Could not load your recruiter workspace">
          <div className="flex items-center justify-between gap-3">
            <span>{getRecruiterErrorMessage(recruiter.error)}</span>
            <Button variant="outline-sm" onClick={recruiter.refetch}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (recruiter.profile === null) {
    return <RecruiterProfileBootstrap title="Recruiter workspace" />;
  }

  if (companies.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <WorkspaceHeader title="Recruiter workspace" />
        <div className="bg-canvas-white rounded-2xl shadow-sm px-6 py-10 flex items-center gap-2 text-body-sm text-text-secondary">
          <Spinner />
          Loading your companies…
        </div>
      </div>
    );
  }

  if (companies.isError) {
    return (
      <div className="flex flex-col gap-6">
        <WorkspaceHeader title="Recruiter workspace" />
        <Alert variant="error" title="Could not load your companies">
          <div className="flex items-center justify-between gap-3">
            <span>{getRecruiterErrorMessage(companies.error)}</span>
            <Button variant="outline-sm" onClick={() => void companies.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const companyList = companies.data ?? [];

  if (companyList.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <WorkspaceHeader title="Recruiter workspace" />
        <CompanySetup />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader title="Recruiter workspace" />
      <JobOffersSection companies={companyList} />
    </div>
  );
}

/** Réglages recruteur : profil (D10) + companies (D11), sans le cycle d'offres. */
export function RecruiterSettings() {
  const recruiter = useRecruiterProfile();
  const companies = useCompanies();

  if (recruiter.isLoading) {
    return <SwitchingOverlay />;
  }

  if (recruiter.isError) {
    return (
      <div className="flex flex-col gap-6">
        <WorkspaceHeader title="Recruiter settings" />
        <Alert variant="error" title="Could not load your recruiter profile">
          <div className="flex items-center justify-between gap-3">
            <span>{getRecruiterErrorMessage(recruiter.error)}</span>
            <Button variant="outline-sm" onClick={recruiter.refetch}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (recruiter.profile === null) {
    return <RecruiterProfileBootstrap title="Recruiter settings" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeader title="Recruiter settings" />
      <RecruiterProfileSection profile={recruiter.profile} />
      {companies.isError ? (
        <Alert variant="error" title="Could not load your companies">
          {getRecruiterErrorMessage(companies.error)}
        </Alert>
      ) : (
        <CompaniesSection />
      )}
    </div>
  );
}
