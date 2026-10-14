"use client";

import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import { toPublicJobArticleModel } from "@/features/job-offer/job-offer-shared";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";

/** publicId = 12 caractères base36 sans tiret ; le reste de l'URL est le slug cosmétique. */
const PUBLIC_ID_PATTERN = /^[0-9a-z]{12}$/;

function parsePublicId(param: string): string | null {
  const separator = param.indexOf("-");
  if (separator !== 12) {
    return null;
  }
  const publicId = param.slice(0, separator);
  return PUBLIC_ID_PATTERN.test(publicId) ? publicId : null;
}

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

function PublicJobDetail({ publicId }: { publicId: string }) {
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

  return <PublicJobArticle article={toPublicJobArticleModel(job.data)} />;
}

/**
 * Fiche publique d'une offre publiée (V15) : rendue sans authentification.
 * La description est le HTML déjà sanitisé stocké en base (D19) — styles
 * scopés `.job-offer-description`.
 */
export function PublicJobView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <NotFound />;
  }
  return <PublicJobDetail publicId={publicId} />;
}
