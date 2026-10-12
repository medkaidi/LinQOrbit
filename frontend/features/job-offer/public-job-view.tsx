"use client";

import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import {
  PublicJobArticle,
  type PublicJobArticleModel,
} from "@/features/job-offer/public-job-article";
import {
  locationLabel,
  salaryLabel,
  SENIORITY_LABELS,
} from "@/features/job-offer/job-offer-shared";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";
import type { SeniorityValue } from "@/types/recruiter";
import type { PublicJob } from "@/types/public-job";

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

function metaLine(job: PublicJob): string[] {
  const seniority = job.seniority
    ? SENIORITY_LABELS[job.seniority as SeniorityValue] ?? null
    : null;
  return [
    job.companyName,
    locationLabel(job.city, job.country),
    seniority,
    job.contractType,
    job.employmentType,
    job.workMode,
    salaryLabel(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
  ].filter((part): part is string => Boolean(part));
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

  const data = job.data;
  const article: PublicJobArticleModel = {
    companyName: data.companyName,
    title: data.title,
    meta: metaLine(data),
    description: data.description,
    skills: data.skills.map((skill) => ({
      id: skill.skillId,
      name: skill.name,
      requirementType: skill.requirementType,
    })),
    languages: data.languages.map((language) => ({
      id: language.languageId,
      name: language.name,
      level: language.level,
    })),
    degreeLabels: data.degreeLabels,
    studyFieldLabels: data.studyFieldLabels,
  };
  return <PublicJobArticle article={article} />;
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
