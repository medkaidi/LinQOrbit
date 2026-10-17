"use client";

import Link from "next/link";

import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  APPLICATION_SECTION,
  APPLICATION_SECTION_HEADER,
  APPLICATION_SECTION_TITLE,
  ApplicationStatusPill,
  appliedOnLabel,
} from "@/features/application/application-shared";
import { ApplicationForm } from "@/features/application/application-form";
import { parsePublicId } from "@/features/job-offer/job-offer-shared";
import { useApplicationContext } from "@/hooks/use-applications";
import type { ApplicationJobSummary, ApplicationSummary } from "@/types/application";

const BREADCRUMB_LINK =
  "hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl py-16 text-center">
      <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
        Job not found
      </h1>
      <p className="mt-3 text-body-md font-body-md text-text-secondary">
        This job offer does not exist, is no longer published, or has expired.
      </p>
    </div>
  );
}

function Header({
  jobParam,
  job,
}: {
  jobParam: string;
  job: ApplicationJobSummary;
}) {
  return (
    <div className="pb-6 border-b border-slate-border">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
      >
        <Link href={`/jobs/${jobParam}`} className={BREADCRUMB_LINK}>
          Job offer
        </Link>
        <span aria-hidden="true" className="text-text-tertiary">
          /
        </span>
        <span className="text-text-primary font-semibold">Apply</span>
      </nav>
      <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
        {job.title}
      </h1>
      {job.companyName ? (
        <p className="mt-1 text-body-md font-body-md text-text-secondary">{job.companyName}</p>
      ) : null}
    </div>
  );
}

function AlreadyApplied({ application }: { application: ApplicationSummary }) {
  const appliedOn = appliedOnLabel(application.createdAt);
  return (
    <section className={APPLICATION_SECTION}>
      <header className={APPLICATION_SECTION_HEADER}>
        <h2 className={APPLICATION_SECTION_TITLE}>Your application</h2>
        <ApplicationStatusPill status={application.status} />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
        <p className="text-body-md font-body-md text-text-primary">
          You have already applied to this job offer
          {appliedOn ? ` on ${appliedOn}` : ""}. A single application per offer is allowed, even
          after a withdrawal.
        </p>
        <NavPill href="/applications" icon="work_history" label="View my applications" />
      </div>
    </section>
  );
}

function ApplicationContextView({
  publicId,
  jobParam,
}: {
  publicId: string;
  jobParam: string;
}) {
  const context = useApplicationContext(publicId);

  if (context.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 py-16 text-body-sm font-body-sm text-text-secondary">
        <Spinner />
        Loading…
      </div>
    );
  }
  if (context.isError || !context.data) {
    return <NotFound />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
      <Header jobParam={jobParam} job={context.data.job} />
      {context.data.existingApplication ? (
        <AlreadyApplied application={context.data.existingApplication} />
      ) : (
        <ApplicationForm context={context.data} />
      )}
    </div>
  );
}

/**
 * Page de candidature `/jobs/[job]/apply` (D48) : contexte de l'offre
 * (questions, CV courant, candidature existante) puis formulaire ou état
 * « déjà candidaté ». Le paramètre `jobParam` mélange publicId (12 car.) et
 * slug cosmétique.
 */
export function ApplyView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <NotFound />;
  }
  return <ApplicationContextView publicId={publicId} jobParam={jobParam} />;
}
