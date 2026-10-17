import type { ReactNode } from "react";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetaChip, OFFER_SALARY_CHIP } from "@/features/job-offer/job-offer-card";
import {
  companyInitials,
  expiryCountdown,
  publicJobPath,
  relativeTimeLabel,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";

/**
 * Article d'une offre (présentation pure, sans `"use client"`) : même rendu
 * pour la fiche publique et la prévisualisation recruteur. L'appelant
 * construit le modèle (labels déjà résolus) — ce composant ne fetch rien.
 * `topBar`, `applyHref` et `relatedJobs` ne sont fournis que par la fiche
 * publique (la prévisualisation n'a ni actions navigateur, ni candidature,
 * ni offres liées).
 */
export type PublicJobArticleModel = {
  companyName: string | null;
  title: string;
  seniority: string | null;
  location: string | null;
  contractType: string | null;
  employmentType: string | null;
  workMode: string | null;
  salary: string | null;
  requiredExpYear: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  description: string | null;
  skills: { id: string; name: string | null; requirementType: string }[];
  languages: { id: string; name: string | null; level: string }[];
  degreeLabels: string[];
  studyFieldLabels: string[];
};

/** Autre offre publiée de la colonne latérale — lien via `publicJobPath`. */
type RelatedPublicJob = {
  publicId: string;
  slug: string;
  title: string;
  salary: string | null;
};

const CARD = "rounded-2xl border border-slate-border bg-canvas-white p-6 shadow-sm";
const SECTION_TITLE = "font-headline-md text-headline-md text-text-primary font-bold";
// Lien-CTA solide (même langage que « Get started » du header) : les CTA de
// l'article naviguent, ils ne déclenchent pas de mutation — jamais un <button>.
const APPLY_CTA =
  "inline-flex shrink-0 items-center justify-center gap-2 h-11 px-6 rounded-full bg-primary-container hover:bg-orange-deep text-canvas-white font-label-lg text-label-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const SKILL_TONES: Record<string, { pill: string; dot: string }> = {
  mandatory: {
    pill: "border-orange-border bg-orange-subtle text-orange-deep",
    dot: "bg-orange-vibrant",
  },
  preferred: {
    pill: "border-blue-border bg-blue-surface text-blue-deep",
    dot: "bg-blue-deep",
  },
};
const SKILL_TONE_NEUTRAL = {
  pill: "border-slate-border bg-item-surface/50 text-text-primary",
  dot: "bg-text-tertiary",
};

function experienceLabel(years: number): string {
  return years > 0 ? `${years}+ yrs experience` : "No experience required";
}

function ArticleSection({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} tone="primary" />
        <h2 className={SECTION_TITLE}>{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Fiche publique d'une offre (T-73, sections à pastille d'icône en T-74) :
 * hero + chips, sections en cartes, colonne latérale sticky (« More from this
 * company ») et barre de candidature sticky. `aria-label` sur les cartes
 * repères : régions adressables en test.
 */
export function PublicJobArticle({
  article,
  applyHref,
  relatedJobs,
  topBar,
}: {
  article: PublicJobArticleModel;
  applyHref?: string;
  relatedJobs?: RelatedPublicJob[];
  topBar?: ReactNode;
}) {
  const posted = article.publishedAt ? relativeTimeLabel(article.publishedAt) : null;
  const expiry = article.expiresAt ? expiryCountdown(article.expiresAt) : null;

  const heroChips: ReactNode[] = [];
  if (article.seniority) {
    heroChips.push(
      <MetaChip key="seniority" icon="signal_cellular_alt">
        {article.seniority}
      </MetaChip>,
    );
  }
  if (article.location) {
    heroChips.push(
      <MetaChip key="location" icon="location_on">
        {article.location}
      </MetaChip>,
    );
  }
  if (article.contractType) {
    heroChips.push(
      <MetaChip key="contract" icon="badge">
        {article.contractType}
      </MetaChip>,
    );
  }
  if (article.employmentType) {
    heroChips.push(
      <MetaChip key="employment-type" icon="schedule">
        {article.employmentType}
      </MetaChip>,
    );
  }
  if (article.workMode) {
    heroChips.push(
      <MetaChip key="work-mode" icon={workModeIcon(article.workMode)}>
        {article.workMode}
      </MetaChip>,
    );
  }
  if (article.salary) {
    heroChips.push(
      <span key="salary" className={OFFER_SALARY_CHIP}>
        <Icon name="payments" className="text-[14px]" />
        {article.salary}
      </span>,
    );
  }
  if (article.requiredExpYear !== null) {
    heroChips.push(
      <MetaChip key="experience" icon="timeline">
        {experienceLabel(article.requiredExpYear)}
      </MetaChip>,
    );
  }
  if (posted) {
    heroChips.push(
      <MetaChip key="posted" icon="history">
        Posted {posted}
      </MetaChip>,
    );
  }
  if (expiry) {
    heroChips.push(
      <MetaChip key="expiry" icon="event" urgent={expiry.urgent}>
        {expiry.label}
      </MetaChip>,
    );
  }

  return (
    <article className="w-full">
      {topBar ? <div className="mb-6">{topBar}</div> : null}

      <section className={CARD} aria-label="Job overview">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-container to-orange-deep font-headline-md text-headline-md font-bold text-canvas-white"
              aria-hidden="true"
            >
              {article.companyName ? (
                companyInitials(article.companyName)
              ) : (
                <Icon name="work" className="text-[28px]" />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`font-label-md text-label-md uppercase tracking-wider ${
                  article.companyName ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                {article.companyName ?? "No company"}
              </p>
              <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
                {article.title}
              </h1>
            </div>
          </div>
          {applyHref ? (
            <Link href={applyHref} className={APPLY_CTA}>
              Apply for this job
            </Link>
          ) : null}
        </div>
        {heroChips.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">{heroChips}</div>
        ) : null}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {article.description ? (
            <ArticleSection icon="description" title="About the role">
              <div
                className="job-offer-description text-body-md font-body-md text-text-primary"
                // HTML déjà sanitisé côté serveur/base (D19) — jamais de HTML cru.
                dangerouslySetInnerHTML={{ __html: article.description }}
              />
            </ArticleSection>
          ) : null}

          {article.skills.length > 0 ? (
            <ArticleSection icon="psychology" title="Skills & requirements">
              <ul className="flex flex-wrap gap-2">
                {article.skills.map((skill) => {
                  const tone = SKILL_TONES[skill.requirementType] ?? SKILL_TONE_NEUTRAL;
                  return (
                    <li
                      key={skill.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body-sm text-body-sm ${tone.pill}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        aria-hidden="true"
                      />
                      {skill.name ?? "Unknown skill"}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-body-sm text-body-sm text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-vibrant" aria-hidden="true" />
                  Mandatory
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-deep" aria-hidden="true" />
                  Preferred
                </span>
              </div>
            </ArticleSection>
          ) : null}

          {article.languages.length > 0 ? (
            <ArticleSection icon="translate" title="Languages">
              <ul className="flex flex-wrap gap-2">
                {article.languages.map((language) => {
                  const reached = LANGUAGE_LEVELS.indexOf(
                    language.level.trim().toUpperCase() as (typeof LANGUAGE_LEVELS)[number],
                  );
                  return (
                    <li
                      key={language.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-border bg-item-surface/50 px-3 py-1.5"
                    >
                      <span className="font-body-sm text-body-sm font-semibold text-text-primary">
                        {language.name ?? "Unknown language"} · {language.level}
                      </span>
                      {reached >= 0 ? (
                        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                          {LANGUAGE_LEVELS.map((level, position) => (
                            <span
                              key={level}
                              className={`h-1.5 w-2.5 rounded-full ${
                                position <= reached ? "bg-blue-deep" : "bg-slate-border"
                              }`}
                            />
                          ))}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </ArticleSection>
          ) : null}

          {article.degreeLabels.length > 0 || article.studyFieldLabels.length > 0 ? (
            <ArticleSection icon="school" title="Education">
              <ul className="flex flex-wrap gap-2">
                {[...article.degreeLabels, ...article.studyFieldLabels].map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-slate-border bg-item-surface/50 px-2.5 py-1 font-body-sm text-body-sm text-text-primary"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </ArticleSection>
          ) : null}
        </div>

        <aside className="lg:col-span-4">
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            {relatedJobs && relatedJobs.length > 0 ? (
              <section className={CARD} aria-label="More from this company">
                <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
                  More from this company
                </h2>
                <ul className="mt-2 flex flex-col divide-y divide-slate-border">
                  {relatedJobs.map((job) => (
                    <li key={job.publicId} className="py-3">
                      <Link
                        href={publicJobPath(job.publicId, job.slug)}
                        className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
                      >
                        <p className="font-body-md text-body-md font-semibold text-text-primary group-hover:text-orange-deep transition-colors">
                          {job.title}
                        </p>
                        {job.salary ? (
                          <p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
                            {job.salary}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-1 font-body-sm text-body-sm font-semibold text-orange-deep hover:underline"
                >
                  Browse all offers
                  <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
              </section>
            ) : null}
          </div>
        </aside>
      </div>

      {applyHref ? (
        <div className="sticky bottom-4 z-30 mt-8 flex flex-col gap-3 rounded-2xl border border-slate-border bg-canvas-white/95 p-4 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-body-md text-body-md font-semibold text-text-primary">
              {article.title}
            </p>
            {[article.companyName, article.salary].filter(Boolean).length > 0 ? (
              <p className="truncate font-body-sm text-body-sm text-text-secondary">
                {[article.companyName, article.salary].filter(Boolean).join(" • ")}
              </p>
            ) : null}
          </div>
          <Link href={applyHref} className={APPLY_CTA}>
            Apply for this job
          </Link>
        </div>
      ) : null}
    </article>
  );
}
