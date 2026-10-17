"use client";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { NavPill } from "@/components/ui/nav-pill";
import {
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { ApplicationStatusPill, appliedOnLabel } from "@/features/application/application-shared";
import { ApplicationForm } from "@/features/application/application-form";
import { PublicJobLoading, PublicJobNotFound } from "@/features/job-offer/public-job-states";
import { parsePublicId } from "@/features/job-offer/job-offer-shared";
import { useApplicationContext } from "@/hooks/use-applications";
import type { ApplicationJobSummary, ApplicationSummary } from "@/types/application";

function Header({
  jobParam,
  job,
}: {
  jobParam: string;
  job: ApplicationJobSummary;
}) {
  return (
    <PageHeader
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbLink href={`/jobs/${jobParam}`}>Job offer</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>Apply</BreadcrumbCurrent>
        </Breadcrumb>
      }
      title={job.title}
      subtitle={job.companyName}
    />
  );
}

function AlreadyApplied({ application }: { application: ApplicationSummary }) {
  const appliedOn = appliedOnLabel(application.createdAt);
  return (
    <section className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Your application</h2>
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
    return <PublicJobLoading />;
  }
  if (context.isError || !context.data) {
    return <PublicJobNotFound />;
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
    return <PublicJobNotFound />;
  }
  return <ApplicationContextView publicId={publicId} jobParam={jobParam} />;
}
