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

function PublicJobDetail({ publicId, jobParam }: { publicId: string; jobParam: string }) {
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
    return <PublicJobNotFound />;
  }
  return <PublicJobDetail publicId={publicId} jobParam={jobParam} />;
}
