import type { ReactNode } from "react";

import { INLINE_PILL_CLASS } from "@/components/ui/pill";
import { OriginBadge } from "@/features/admin/normalized/normalized-origin-badge";
import { SectionBlock } from "@/features/admin/normalized/normalized-section-block";
import { NormalizedSheetRail } from "@/features/admin/normalized/normalized-sheet-rail";
import { SkillsTable } from "@/features/admin/normalized/normalized-skills-table";
import {
  SpecGrid,
  type SpecCell,
} from "@/features/admin/normalized/normalized-spec-grid";
import {
  NORMALIZED_ITEM_CARD,
  NORMALIZED_MUTED,
  PROJECT_CONTEXT_LABELS,
  candidateSheetStats,
  formatMonth,
  formatPeriod,
} from "@/features/admin/normalized/normalized-shared";
import { seniorityLabel } from "@/features/job-offer/job-offer-shared";
import type {
  NormalizedCandidateProfile,
  NormalizedDiploma,
  NormalizedExperience,
  NormalizedProject,
} from "@/types/normalized";

const KIND_TONES = {
  Experience: "bg-orange-subtle border-orange-border text-orange-deep",
  Project: "bg-blue-surface border-blue-border text-blue-deep",
  Diploma: "bg-success-surface border-success-border text-success-text",
} as const;

const KIND_LABELS = {
  Experience: "Experience",
  Project: "Project",
  Diploma: "Diploma",
} as const;

type TimelineKind = keyof typeof KIND_TONES;

type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  /** startDate YYYY-MM, null = sans date → trié en fin. */
  startedAt: string | null;
  order: number;
  period: string | null;
  ongoing: boolean;
  title: string;
  meta?: string | null;
  origin?: string | null;
  body: ReactNode;
};

function TechChips({ technologies }: { technologies?: string[] }) {
  if (!technologies || technologies.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-1.5 pt-1">
      {technologies.map((technology, index) => (
        <li
          key={index}
          className="rounded-md border border-slate-border bg-canvas-white px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary"
        >
          {technology}
        </li>
      ))}
    </ul>
  );
}

function toTimelineEntries(profile: NormalizedCandidateProfile): TimelineEntry[] {
  let order = 0;
  const experiences: TimelineEntry[] = (profile.experiences ?? []).map(
    (experience: NormalizedExperience, index) => ({
      id: `experience-${index}`,
      kind: "Experience",
      startedAt: experience.startDate ?? null,
      order: order++,
      period: formatPeriod(experience.startDate, experience.endDate),
      ongoing: Boolean(experience.startDate) && experience.endDate == null,
      title: [
        experience.positionTitle ?? "Experience",
        experience.companyName,
      ]
        .filter(Boolean)
        .join(" · "),
      meta: experience.domain,
      body: (
        <>
          {experience.description && (
            <p className="text-body-sm font-body-sm text-text-primary leading-relaxed">
              {experience.description}
            </p>
          )}
          <TechChips technologies={experience.technologies} />
          {experience.achievements && experience.achievements.length > 0 && (
            <ul className="flex flex-col gap-1">
              {experience.achievements.map((achievement, achievementIndex) => (
                <li
                  key={achievementIndex}
                  className="text-body-sm font-body-sm text-text-primary"
                >
                  · {achievement}
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    }),
  );
  const projects: TimelineEntry[] = (profile.projects ?? []).map(
    (project: NormalizedProject, index) => ({
      id: `project-${index}`,
      kind: "Project",
      startedAt: project.startDate ?? null,
      order: order++,
      period: formatPeriod(project.startDate, project.endDate),
      ongoing: Boolean(project.startDate) && project.endDate == null,
      title: [project.name ?? "Project", project.role].filter(Boolean).join(" · "),
      meta: project.context ? PROJECT_CONTEXT_LABELS[project.context] ?? project.context : null,
      body: (
        <>
          {project.description && (
            <p className="text-body-sm font-body-sm text-text-primary leading-relaxed">
              {project.description}
            </p>
          )}
          <TechChips technologies={project.technologies} />
        </>
      ),
    }),
  );
  const diplomas: TimelineEntry[] = (profile.diplomas ?? []).map(
    (diploma: NormalizedDiploma, index) => ({
      id: `diploma-${index}`,
      kind: "Diploma",
      startedAt: diploma.startDate ?? null,
      order: order++,
      period: formatPeriod(diploma.startDate, diploma.endDate),
      ongoing: Boolean(diploma.startDate) && diploma.endDate == null,
      title: [diploma.title ?? "Diploma", diploma.institution].filter(Boolean).join(" · "),
      meta: [diploma.degreeLabel, diploma.studyFieldLabel].filter(Boolean).join(" · ") || null,
      origin: diploma.origin,
      body: null,
    }),
  );

  return [...experiences, ...projects, ...diplomas].sort((a, b) => {
    const byDate = (b.startedAt ?? "").localeCompare(a.startedAt ?? "");
    return byDate !== 0 ? byDate : a.order - b.order;
  });
}

/**
 * Fiche normalisée candidat schema v3 (D36) : rendu friendly du contenu
 * canonique — jamais de JSON brut. Sections numérotées pleine largeur
 * (spec-grid identité, tableau compétences, timeline fusionnée
 * expériences+projets+diplômes, langues, certifications, liens), widgets
 * provenance/couverture en rangée basse deux colonnes (empilés sous `md`).
 * Tolère tout champ absent ou null.
 */
export function NormalizedCandidateView({ profile }: { profile: NormalizedCandidateProfile }) {
  const skills = profile.skills ?? [];
  const languages = profile.languages ?? [];
  const certifications = profile.certifications ?? [];
  const links = profile.links ?? [];
  const timelineEntries = toTimelineEntries(profile);

  const identityCells: SpecCell[] = [
    {
      label: "Seniority",
      value: profile.seniority
        ? seniorityLabel(profile.seniority) ?? profile.seniority
        : null,
    },
    {
      label: "Experience",
      value: profile.yearsOfExperience != null ? `${profile.yearsOfExperience} yrs` : null,
    },
    {
      label: "Location",
      value: profile.location
        ? [profile.location.city, profile.location.country].filter(Boolean).join(", ") ||
          null
        : null,
    },
    { label: "Search status", value: profile.searchStatus },
    { label: "Target role", value: profile.targetRole },
  ];
  const hasOverview = Boolean(profile.title || profile.summary) || identityCells.some(
    (cell) => cell.value,
  );

  const isEmpty =
    skills.length === 0 &&
    timelineEntries.length === 0 &&
    languages.length === 0 &&
    certifications.length === 0 &&
    links.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 min-w-0">
        {hasOverview && (
          <SectionBlock index={1} title={profile.title ?? "Profile overview"}>
            <div className="flex flex-col gap-4">
              <SpecGrid cells={identityCells} />
              {profile.summary && (
                <p className="text-body-md font-body-md text-text-primary leading-relaxed">
                  {profile.summary}
                </p>
              )}
            </div>
          </SectionBlock>
        )}

        {skills.length > 0 && (
          <SectionBlock index={2} title="Skills" meta={`${skills.length} entries`}>
            <SkillsTable
              columns={["Skill", "Level", "Years", "Evidence", "Origin"]}
              minWidthClass="min-w-[540px]"
              rows={skills.map((skill) => ({
                skill,
                cells: (
                  <>
                    <td className="py-3 pr-3 font-mono text-text-primary">
                      {skill.level != null ? `${skill.level}/5` : "—"}
                    </td>
                    <td className="py-3 pr-3 font-mono text-text-primary">
                      {skill.yearsExperience != null ? `${skill.yearsExperience} yrs` : "—"}
                    </td>
                  </>
                ),
              }))}
            />
          </SectionBlock>
        )}

        {timelineEntries.length > 0 && (
          <SectionBlock
            index={3}
            title="Career timeline"
            meta={`${timelineEntries.length} events`}
          >
            <ul className="relative flex flex-col gap-4 before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-border">
              {timelineEntries.map((entry) => (
                <li key={entry.id} className="relative pl-8">
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-4 w-3.5 h-3.5 rounded-full ring-4 ring-canvas-white ${KIND_TONES[entry.kind]}`}
                  />
                  <div className={NORMALIZED_ITEM_CARD}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-2 mb-2 border-b border-slate-border">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {entry.period && (
                          <span
                            className={
                              entry.ongoing
                                ? "rounded-full border border-success-border bg-success-surface px-2.5 py-1 font-label-caps text-label-caps normal-case tracking-normal text-success-text shrink-0"
                                : "rounded-full border border-slate-border bg-canvas-white px-2.5 py-1 font-label-caps text-label-caps normal-case tracking-normal text-text-secondary shrink-0"
                            }
                          >
                            {entry.period}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2.5 py-1 font-label-caps text-label-caps normal-case tracking-normal shrink-0 ${KIND_TONES[entry.kind]}`}
                        >
                          {KIND_LABELS[entry.kind]}
                        </span>
                        <span className="font-label-lg text-label-lg font-semibold text-text-primary min-w-0">
                          {entry.title}
                        </span>
                      </div>
                      <OriginBadge origin={entry.origin ?? undefined} />
                    </div>
                    {entry.meta && (
                      <p className="text-body-sm font-body-sm text-text-secondary">
                        {entry.meta}
                      </p>
                    )}
                    <div className={entry.meta ? "mt-2 flex flex-col gap-2" : "flex flex-col gap-2"}>
                      {entry.body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {languages.length > 0 && (
          <SectionBlock index={4} title="Languages" meta={`${languages.length} entries`}>
            <ul className="flex flex-wrap gap-2">
              {languages.map((language, index) => (
                <li
                  key={index}
                  className={INLINE_PILL_CLASS}
                >
                  <span>
                    {language.name ?? "Language"}
                    {language.level ? ` · ${language.level}` : ""}
                  </span>
                  <OriginBadge origin={language.origin} />
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {certifications.length > 0 && (
          <SectionBlock
            index={5}
            title="Certifications"
            meta={`${certifications.length} entries`}
          >
            <ul className="flex flex-col gap-3">
              {certifications.map((certification, index) => (
                <li key={index} className={NORMALIZED_ITEM_CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-md font-body-md text-text-primary font-semibold">
                      {certification.name ?? "Certification"}
                    </p>
                    <OriginBadge origin={certification.origin} />
                  </div>
                  <p className={`${NORMALIZED_MUTED} mt-1`}>
                    {[certification.issuer, formatMonth(certification.issuedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {links.length > 0 && (
          <SectionBlock index={6} title="Links" meta={`${links.length} entries`}>
            <ul className="flex flex-col gap-2">
              {links.map((link, index) => (
                <li key={index} className="text-body-sm font-body-sm">
                  <span className="text-text-secondary">{link.label ?? "Link"}: </span>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-deep hover:underline break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
                    >
                      {link.url}
                    </a>
                  ) : (
                    <span className={NORMALIZED_MUTED}>—</span>
                  )}
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {isEmpty && (
          <p className={NORMALIZED_MUTED}>
            The normalized profile is empty — the AI service found no content to extract.
          </p>
        )}
      </div>

      <NormalizedSheetRail stats={candidateSheetStats(profile)} />
    </div>
  );
}
