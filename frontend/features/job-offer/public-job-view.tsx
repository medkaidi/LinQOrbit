"use client";

import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import {
  locationLabel,
  salaryLabel,
  SENIORITY_LABELS,
} from "@/features/job-offer/job-offer-shared";
import { getPublicJob } from "@/lib/api/public-jobs.api";
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

function useJob(publicId: string | null) {
  return useQuery({
    queryKey: ["public-jobs", publicId],
    queryFn: () => getPublicJob(publicId as string),
    enabled: publicId != null,
    retry: false,
  });
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

/**
 * Fiche publique d'une offre publiée (V15) : rendue sans authentification.
 * La description est le HTML déjà sanitisé stocké en base (D19) — styles
 * scopés `.job-offer-description`.
 */
export function PublicJobView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  const job = useJob(publicId);

  if (publicId == null) {
    return <NotFound />;
  }
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
  const meta = metaLine(data);

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12 lg:py-16">
      <header className="border-b border-slate-border pb-6">
        {data.companyName ? (
          <p className="font-label-md text-label-md text-text-secondary">{data.companyName}</p>
        ) : null}
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          {data.title}
        </h1>
        {meta.length > 0 ? (
          <p className="mt-2 text-body-md font-body-md text-text-secondary">
            {meta.join(" · ")}
          </p>
        ) : null}
      </header>

      {data.description ? (
        <section className="mt-8">
          <div
            className="job-offer-description text-body-md font-body-md text-text-primary"
            // HTML déjà sanitisé côté serveur/base (D19) — jamais de HTML cru.
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Skills
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.skills.map((skill) => (
              <li
                key={skill.skillId}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {skill.name ?? "Unknown skill"}
                {skill.requirementType === "mandatory" ? (
                  <span className="ml-1.5 text-text-secondary">· required</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.languages.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Languages
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.languages.map((language) => (
              <li
                key={language.languageId}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {language.name ?? "Unknown language"} · {language.level}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.degreeLabels.length > 0 || data.studyFieldLabels.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
            Education
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...data.degreeLabels, ...data.studyFieldLabels].map((label) => (
              <li
                key={label}
                className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
