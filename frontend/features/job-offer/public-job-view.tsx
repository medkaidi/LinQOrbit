"use client";

import { NavPill } from "@/components/ui/nav-pill";
import { CopyPublicLinkButton } from "@/features/job-offer/copy-public-link-button";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import { PublicJobLoading, PublicJobNotFound } from "@/features/job-offer/public-job-states";
import {
  parsePublicId,
  salaryLabel,
  toPublicJobArticleModel,
} from "@/features/job-offer/job-offer-shared";
import { usePublicJob, useRelatedPublicJobs } from "@/hooks/use-public-jobs";

function PublicJobDetail({
  publicId,
  jobParam,
  backHref,
  basePath,
}: {
  publicId: string;
  jobParam: string;
  backHref: string;
  basePath: string;
}) {
  const job = usePublicJob(publicId);
  const related = useRelatedPublicJobs(publicId, { enabled: job.data != null });

  if (job.isLoading) {
    return <PublicJobLoading />;
  }
  if (job.isError || !job.data) {
    return <PublicJobNotFound />;
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
      boardHref={backHref}
      basePath={basePath}
      topBar={
        <div className="flex items-center justify-between gap-3">
          <NavPill href={backHref} icon="arrow_back" label="Back to offers" />
          <CopyPublicLinkButton publicId={job.data.publicId} slug={job.data.slug} basePath={basePath} />
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
 *
 * `backHref` et `basePath` distinguent les deux boards : `/jobs` (board
 * authentifié) et `/public/jobs` (vitrine publique, D100/T-113) — la fiche
 * elle-même est la même.
 */
export function PublicJobView({
  jobParam,
  backHref = "/jobs",
  basePath = "/jobs",
}: {
  jobParam: string;
  backHref?: string;
  basePath?: string;
}) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <PublicJobNotFound />;
  }
  return (
    <PublicJobDetail
      publicId={publicId}
      jobParam={jobParam}
      backHref={backHref}
      basePath={basePath}
    />
  );
}
