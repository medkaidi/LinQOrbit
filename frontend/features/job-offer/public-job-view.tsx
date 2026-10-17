"use client";

import { useQuery } from "@tanstack/react-query";

import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import { parsePublicId, toPublicJobArticleModel } from "@/features/job-offer/job-offer-shared";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
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

  if (job.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 py-16 text-body-sm font-body-sm text-text-secondary">
        <Spinner />
        Loading…
      </div>
    );
  }
  if (job.isError || !job.data) {
    return <NotFound />;
  }

  return (
    <>
      <PublicJobArticle article={toPublicJobArticleModel(job.data)} />
      <div className="mx-auto w-full max-w-3xl px-6 pb-12 lg:pb-16 -mt-4">
        <NavPill href={`/jobs/${jobParam}/apply`} icon="send" label="Apply for this job" />
      </div>
    </>
  );
}

/**
 * Fiche publique d'une offre publiée (V15) : rendue sans authentification.
 * La description est le HTML déjà sanitisé stocké en base (D19) — styles
 * scopés `.job-offer-description`. Le CTA « Apply » mène au formulaire de
 * candidature (AuthGate → login avec retour si nécessaire).
 */
export function PublicJobView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <NotFound />;
  }
  return <PublicJobDetail publicId={publicId} jobParam={jobParam} />;
}
