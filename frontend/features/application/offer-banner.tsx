"use client";

import { useId, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import { SECTION_CARD_CLASS } from "@/components/ui/section";
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
import { cn } from "@/lib/utils/cn";
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
 * Bandeau de l'offre en tête du parcours de candidature (D59, maquettes
 * `matching_screen_upper_drawer_{off,on}.html`) : résumé réel de l'offre et,
 * en pied de carte, « View full job description » + chevron. Le clic déplie
 * la carte **vers le bas en accordéon, dans le flux** : le détail (même rendu
 * que la fiche publique, sans CTA ni offres liées) s'insère entre le résumé et
 * le pied, le contenu de la page est décalé d'autant — aucun voile. Le bouton
 * reste le même élément (le focus ne bouge pas) ; replié, le détail est
 * `inert` et masqué des technologies d'assistance.
 */
export function OfferBanner({ publicId }: { publicId: string }) {
  const job = usePublicJob(publicId);
  const [expanded, setExpanded] = useState(false);
  // Détail monté au premier dépli seulement, puis gardé : le repli reste animé.
  const [unfolded, setUnfolded] = useState(false);
  const detailId = useId();

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
      // Bas de carte = pt-3 du pied : espace égal au-dessus et au-dessous du bouton.
      className={cn(SECTION_CARD_CLASS, "px-4 pt-4 pb-3 lg:px-5 lg:pt-5")}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <span
            aria-hidden="true"
            className="w-12 h-12 shrink-0 rounded-2xl bg-orange-subtle border border-orange-border flex items-center justify-center font-bold text-orange-deep"
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
          </div>
        </div>
        {skills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:max-w-[40%]">
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

      {/* Accordéon : 0fr → 1fr anime la hauteur réelle du détail sans la mesurer. */}
      <div
        id={detailId}
        role="region"
        aria-label="Full job description"
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-4 pt-4 border-t border-slate-border">
            {unfolded ? <PublicJobArticle article={toPublicJobArticleModel(data)} embedded /> : null}
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-border flex justify-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => {
            setUnfolded(true);
            setExpanded((open) => !open);
          }}
          className="group inline-flex items-center gap-2 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep font-label-md text-label-md font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>{expanded ? "Hide full job description" : "View full job description"}</span>
          <span
            aria-hidden="true"
            className="w-5 h-5 rounded-full bg-slate-surface group-hover:bg-slate-border flex items-center justify-center transition-colors"
          >
            {/* Glyphe un peu haut dans sa boîte : 16px + 0,5px vers le bas le centrent (mesuré de 100 % à 200 % de zoom). */}
            <Icon name={expanded ? "expand_less" : "expand_more"} className="text-[16px] translate-y-[0.5px]" />
          </span>
        </button>
      </div>
    </section>
  );
}
