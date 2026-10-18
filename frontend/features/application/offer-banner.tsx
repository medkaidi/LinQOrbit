"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import { MetaChip, OFFER_SALARY_CHIP } from "@/features/job-offer/job-offer-card";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import {
  companyInitials,
  locationLabel,
  salaryLabel,
  seniorityLabel,
  toPublicJobArticleModel,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";
import { usePublicJob } from "@/hooks/use-public-jobs";
import type { PublicJob } from "@/types/public-job";

/** Compétences clés du bandeau : les obligatoires, poids décroissant, au plus 5. */
const KEY_SKILLS_LIMIT = 5;

function keySkills(job: PublicJob): string[] {
  return job.skills
    .filter((skill) => skill.requirementType === "mandatory" && skill.name)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, KEY_SKILLS_LIMIT)
    .map((skill) => skill.name as string);
}

/**
 * Bandeau compact de l'offre en tête du parcours de candidature (D59,
 * maquettes `matching_screen_upper_drawer_{off,on}.html`) : les informations
 * clés réelles de l'offre ; « View full job description » descend un rideau
 * (`Dialog placement="top"`, fond qui masque la page) portant le même rendu
 * que la fiche publique, sans CTA ni offres liées.
 */
export function OfferBanner({ publicId }: { publicId: string }) {
  const job = usePublicJob(publicId);
  const [curtainOpen, setCurtainOpen] = useState(false);

  if (!job.data) {
    return null;
  }

  const data = job.data;
  const location = locationLabel(data.city, data.country);
  const seniority = seniorityLabel(data.seniority);
  const salary = salaryLabel(data.salaryMin, data.salaryMax, data.salaryCurrency, data.salaryPeriod);
  const skills = keySkills(data);

  return (
    <section
      aria-label="Job offer summary"
      className="bg-canvas-white rounded-2xl shadow-sm p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <span
          aria-hidden="true"
          className="w-12 h-12 shrink-0 rounded-xl bg-orange-subtle border border-orange-border flex items-center justify-center font-bold text-orange-deep"
        >
          {data.companyName ? companyInitials(data.companyName) : <Icon name="work" />}
        </span>
        <div className="min-w-0">
          {data.companyName ? (
            <p className="font-label-md text-label-md uppercase font-bold text-text-primary">
              {data.companyName}
            </p>
          ) : null}
          <p className="font-headline-sm text-headline-sm text-text-primary font-bold tracking-tight">
            {data.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {location ? <MetaChip icon="location_on">{location}</MetaChip> : null}
            {data.workMode ? <MetaChip icon={workModeIcon(data.workMode)}>{data.workMode}</MetaChip> : null}
            {seniority ? <MetaChip icon="signal_cellular_alt">{seniority}</MetaChip> : null}
            {data.requiredExpYear != null ? (
              <MetaChip icon="timelapse">{`${data.requiredExpYear}+ years of experience`}</MetaChip>
            ) : null}
            {salary ? (
              <span className={OFFER_SALARY_CHIP}>
                <Icon name="payments" className="text-[14px]" />
                {salary}
              </span>
            ) : null}
          </div>
          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                Key skills
              </span>
              {skills.map((skill) => (
                <span key={skill} className={MUTED_PILL_CLASS}>
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <Button variant="outline-sm" type="button" className="shrink-0" onClick={() => setCurtainOpen(true)}>
        View full job description
      </Button>

      {curtainOpen ? (
        <Dialog
          placement="top"
          title={data.title}
          description={data.companyName}
          onClose={() => setCurtainOpen(false)}
          footer={
            <Button variant="outline-sm" type="button" onClick={() => setCurtainOpen(false)}>
              Back to my application
            </Button>
          }
        >
          <PublicJobArticle article={toPublicJobArticleModel(data)} />
        </Dialog>
      ) : null}
    </section>
  );
}
