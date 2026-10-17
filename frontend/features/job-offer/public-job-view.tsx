"use client";

import { useQuery } from "@tanstack/react-query";

import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import { CopyPublicLinkButton } from "@/features/job-offer/copy-public-link-button";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import {
  parsePublicId,
  salaryLabel,
  toPublicJobArticleModel,
} from "@/features/job-offer/job-offer-shared";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";
import { useRelatedPublicJobs } from "@/hooks/use-public-jobs";

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

function PublicJobDetail({ publicId, jobParam }: { publicId: string; jobParam: string }) {
  const job = useQuery({
    queryKey: queryKeys.publicJobs.detail(publicId),
    queryFn: () => getPublicJob(publicId),
    retry: false,
  });
  const related = useRelatedPublicJobs(publicId, { enabled: job.data != null });

  if (job.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 py-16 text-body-sm font-body-sm text-text-secondary">
        <Spinner />
        Loading…
      </div>
    );
  }
  if (job.isError || !job.data) {
    return <NotFound />;
  }

  const relatedJobs = (related.data ?? []).map((item) => ({
    publicId: item.publicId,
    slug: item.slug,
    title: item.title,
    salary: salaryLabel(
      item.salaryMin,
      item.salaryMax,
      item.salaryCurrency,
      item.salaryPeriod,
    ),
  }));

  return (
    <PublicJobArticle
      article={toPublicJobArticleModel(job.data)}
      applyHref={`/jobs/${jobParam}/apply`}
      relatedJobs={relatedJobs}
      topBar={
        <div className="flex items-center justify-between gap-3">
          <NavPill href="/jobs" icon="arrow_back" label="Back to offers" />
          <CopyPublicLinkButton publicId={job.data.publicId} slug={job.data.slug} />
        </div>
      }
    />
  );
}

/**
 * Fiche publique d'une offre publiée (V15, restylée T-73) : rendue sans
 * authentification. La description est le HTML déjà sanitisé stocké en base
 * (D19) — styles scopés `.job-offer-description`. Les CTA « Apply » mènent au
 * formulaire de candidature (AuthGate → login avec retour si nécessaire).
 */
export function PublicJobView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <NotFound />;
  }
  return <PublicJobDetail publicId={publicId} jobParam={jobParam} />;
}
