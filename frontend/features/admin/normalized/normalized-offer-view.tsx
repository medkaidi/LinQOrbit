import { Badge } from "@/components/ui/badge";
import { OriginBadge } from "@/features/admin/normalized/normalized-origin-badge";
import { SectionBlock } from "@/features/admin/normalized/normalized-section-block";
import { NormalizedSheetRail } from "@/features/admin/normalized/normalized-sheet-rail";
import {
  SpecGrid,
  type SpecCell,
} from "@/features/admin/normalized/normalized-spec-grid";
import {
  NORMALIZED_BLOCK_TITLE,
  NORMALIZED_ITEM_CARD,
  NORMALIZED_MUTED,
  SENIORITY_LABELS,
  categoryLabel,
  evidenceLabel,
  offerSheetStats,
} from "@/features/admin/normalized/normalized-shared";
import type {
  NormalizedJobOffer,
  NormalizedResponsibility,
  NormalizedSalary,
  OfferRequirementEntry,
  OfferSkillRequirement,
} from "@/types/normalized";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed-term",
  freelance: "Freelance",
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  volunteer: "Volunteer",
};

const WORK_TIME_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
};

const WORK_MODE_LABELS: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On-site",
};

function formatSalary(salary: NormalizedSalary | null | undefined): string | null {
  if (!salary) {
    return null;
  }
  const bounds =
    salary.min != null || salary.max != null
      ? [
          salary.min != null
            ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(salary.min)
            : null,
          salary.max != null
            ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(salary.max)
            : null,
        ]
          .filter(Boolean)
          .join(" – ")
      : null;
  const line = [bounds, salary.currency, salary.period ? `per ${salary.period}` : null]
    .filter(Boolean)
    .join(" ");
  return line || null;
}

function ResponsibilityItem({ responsibility }: { responsibility: NormalizedResponsibility }) {
  return (
    <li className={NORMALIZED_ITEM_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-body-sm font-body-sm text-text-primary leading-relaxed min-w-0">
          {responsibility.text ?? "Responsibility"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {responsibility.weight != null && (
            <span className={NORMALIZED_MUTED}>Weight {responsibility.weight}/5</span>
          )}
          <Badge tone={responsibility.importance === "mandatory" ? "success" : "neutral"}>
            {responsibility.importance === "optional" ? "Optional" : "Mandatory"}
          </Badge>
        </div>
      </div>
      {(responsibility.domain || (responsibility.technologies ?? []).length > 0) && (
        <p className={`${NORMALIZED_MUTED} mt-1`}>
          {[
            responsibility.domain,
            (responsibility.technologies ?? []).length > 0
              ? responsibility.technologies!.join(", ")
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </li>
  );
}

function RequirementEntryItem({
  kind,
  entry,
}: {
  kind: "Degree" | "Field of study";
  entry: OfferRequirementEntry;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary">
        {kind}: {entry.label ?? "—"}
      </span>
      <OriginBadge origin={entry.source} />
    </li>
  );
}

function SkillsTable({
  requiredSkills,
  preferredSkills,
}: {
  requiredSkills: OfferSkillRequirement[];
  preferredSkills: OfferSkillRequirement[];
}) {
  const rows = [
    ...requiredSkills.map((skill) => ({ skill, requirement: "Required" as const })),
    ...preferredSkills.map((skill) => ({ skill, requirement: "Preferred" as const })),
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-border">
            {["Skill", "Requirement", "Weight", "Level", "Min years", "Evidence", "Origin"].map(
              (column) => (
                <th
                  key={column}
                  className="py-2.5 pr-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary"
                >
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-border text-body-sm font-body-sm">
          {rows.map(({ skill, requirement }, index) => {
            const evidence = evidenceLabel(skill.evidence);
            const category = categoryLabel(skill.category);
            return (
              <tr key={index} className="hover:bg-item-surface/50 transition-colors">
                <td className="py-3 pr-3 min-w-36">
                  <span className="block font-semibold text-text-primary">
                    {skill.name ?? "Unnamed skill"}
                  </span>
                  {category && <span className="block text-text-secondary">{category}</span>}
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={
                      requirement === "Required"
                        ? "font-label-caps text-label-caps uppercase tracking-wider text-orange-deep"
                        : "font-label-caps text-label-caps uppercase tracking-wider text-text-secondary"
                    }
                  >
                    {requirement}
                  </span>
                </td>
                <td className="py-3 pr-3 font-mono text-text-primary">
                  {skill.weight != null ? `${skill.weight}/5` : "—"}
                </td>
                <td className="py-3 pr-3 font-mono text-text-primary">
                  {skill.level != null ? `${skill.level}/5` : "—"}
                </td>
                <td className="py-3 pr-3 font-mono text-text-primary">
                  {skill.minYears != null
                    ? `${skill.minYears}+ yrs${skill.minYearsSource === "inferred" ? " (inferred)" : ""}`
                    : "—"}
                </td>
                <td className="py-3 pr-3 text-text-secondary">{evidence ?? "—"}</td>
                <td className="py-3 pr-3">
                  {skill.origin ? (
                    <OriginBadge origin={skill.origin} />
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Fiche normalisée offre schema v2 (D35) : rendu friendly du contenu
 * canonique — jamais de JSON brut. Grille 8/4 : sections lettrées A-G à
 * gauche (spec-grid identité + récit, tableau skills required/preferred,
 * responsabilités, exigences, langues, certifications, bénéfices), rail de
 * provenance/couverture à droite. Tolère tout champ absent — les fiches v1
 * n'ont ni weight ni origin (cellules « — », badges absents).
 */
export function NormalizedOfferView({ offer }: { offer: NormalizedJobOffer }) {
  const responsibilities = offer.responsibilities ?? [];
  const requiredSkills = offer.requiredSkills ?? [];
  const preferredSkills = offer.preferredSkills ?? [];
  const requiredDegrees = offer.requiredDegrees ?? [];
  const requiredStudyFields = offer.requiredStudyFields ?? [];
  const languages = offer.languages ?? [];
  const certifications = offer.certifications ?? [];
  const benefits = offer.benefits ?? [];
  const alternateTitles = offer.alternateTitles ?? [];

  const identityCells: SpecCell[] = [
    { label: "Domain", value: offer.domain },
    {
      label: "Contract",
      value: offer.contractType
        ? CONTRACT_TYPE_LABELS[offer.contractType] ?? offer.contractType
        : null,
    },
    {
      label: "Work time",
      value: offer.workTime ? WORK_TIME_LABELS[offer.workTime] ?? offer.workTime : null,
    },
    {
      label: "Seniority",
      value: offer.seniority ? SENIORITY_LABELS[offer.seniority] ?? offer.seniority : null,
    },
    {
      label: "Work mode",
      value: offer.workMode ? WORK_MODE_LABELS[offer.workMode] ?? offer.workMode : null,
    },
    {
      label: "Location",
      value: offer.location
        ? [offer.location.city, offer.location.country].filter(Boolean).join(", ") || null
        : null,
    },
    { label: "Salary", value: formatSalary(offer.salary), mono: true },
  ];
  const hasOverview =
    Boolean(offer.title || offer.summary || offer.companyPitch || offer.description) ||
    identityCells.some((cell) => cell.value) ||
    alternateTitles.length > 0;

  const hasRequirements =
    offer.requiredYears != null || requiredDegrees.length > 0 || requiredStudyFields.length > 0;

  const isEmpty =
    responsibilities.length === 0 &&
    requiredSkills.length === 0 &&
    preferredSkills.length === 0 &&
    requiredDegrees.length === 0 &&
    requiredStudyFields.length === 0 &&
    languages.length === 0 &&
    certifications.length === 0 &&
    benefits.length === 0 &&
    offer.requiredYears == null &&
    !offer.summary &&
    !offer.description;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8 flex flex-col gap-6 min-w-0">
        {hasOverview && (
          <SectionBlock index={1} title={offer.title ?? "Offer overview"}>
            <div className="flex flex-col gap-4">
              <SpecGrid cells={identityCells} />
              {alternateTitles.length > 0 && (
                <p className={NORMALIZED_MUTED}>
                  Also known as: {alternateTitles.join(", ")}
                </p>
              )}
              {offer.summary && (
                <p className="text-body-md font-body-md text-text-primary leading-relaxed">
                  {offer.summary}
                </p>
              )}
              {offer.companyPitch && (
                <div>
                  <h4 className={NORMALIZED_BLOCK_TITLE}>Company</h4>
                  <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed">
                    {offer.companyPitch}
                  </p>
                </div>
              )}
              {offer.description && (
                <div>
                  <h4 className={NORMALIZED_BLOCK_TITLE}>Description</h4>
                  <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed whitespace-pre-line">
                    {offer.description}
                  </p>
                </div>
              )}
            </div>
          </SectionBlock>
        )}

        {requiredSkills.length > 0 || preferredSkills.length > 0 ? (
          <SectionBlock
            index={2}
            title="Skills"
            meta={`${requiredSkills.length} required · ${preferredSkills.length} preferred`}
          >
            <SkillsTable
              requiredSkills={requiredSkills}
              preferredSkills={preferredSkills}
            />
          </SectionBlock>
        ) : null}

        {responsibilities.length > 0 && (
          <SectionBlock
            index={3}
            title="Responsibilities"
            meta={`${responsibilities.length} entries`}
          >
            <ul className="flex flex-col gap-3">
              {responsibilities.map((responsibility, index) => (
                <ResponsibilityItem key={index} responsibility={responsibility} />
              ))}
            </ul>
          </SectionBlock>
        )}

        {hasRequirements && (
          <SectionBlock
            index={4}
            title="Requirements"
            meta={
              [
                offer.requiredYears != null ? `${offer.requiredYears}+ yrs` : null,
                requiredDegrees.length + requiredStudyFields.length > 0
                  ? `${requiredDegrees.length + requiredStudyFields.length} education`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
          >
            <div className="flex flex-col gap-4">
              {offer.requiredYears != null && (
                <div>
                  <h4 className={NORMALIZED_BLOCK_TITLE}>Required experience</h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary">
                      {offer.requiredYears}+ yrs total
                    </span>
                    <OriginBadge origin={offer.requiredYearsSource} />
                  </div>
                </div>
              )}
              {(requiredDegrees.length > 0 || requiredStudyFields.length > 0) && (
                <div>
                  <h4 className={NORMALIZED_BLOCK_TITLE}>Education requirements</h4>
                  <ul className="mt-2 flex flex-col gap-2">
                    {[
                      ...requiredDegrees.map((entry) => ({ kind: "Degree" as const, entry })),
                      ...requiredStudyFields.map((entry) => ({
                        kind: "Field of study" as const,
                        entry,
                      })),
                    ].map(({ kind, entry }, index) => (
                      <RequirementEntryItem key={index} kind={kind} entry={entry} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionBlock>
        )}

        {languages.length > 0 && (
          <SectionBlock index={5} title="Languages" meta={`${languages.length} entries`}>
            <ul className="flex flex-wrap gap-2">
              {languages.map((language, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary"
                >
                  <span>
                    {language.name ?? "Language"}
                    {language.level ? ` · ${language.level}` : ""}
                    {language.required === false ? " (nice-to-have)" : ""}
                  </span>
                  <OriginBadge origin={language.origin} />
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {certifications.length > 0 && (
          <SectionBlock
            index={6}
            title="Certifications"
            meta={`${certifications.length} entries`}
          >
            <ul className="flex flex-col gap-3">
              {certifications.map((certification, index) => (
                <li key={index} className={NORMALIZED_ITEM_CARD}>
                  <p className="text-body-md font-body-md text-text-primary font-semibold">
                    {certification.name ?? "Certification"}
                  </p>
                  <p className={`${NORMALIZED_MUTED} mt-1`}>
                    {[certification.issuer, certification.issuedAt]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {benefits.length > 0 && (
          <SectionBlock index={7} title="Benefits" meta={`${benefits.length} entries`}>
            <ul className="flex flex-col gap-1">
              {benefits.map((benefit, index) => (
                <li key={index} className="text-body-sm font-body-sm text-text-primary">
                  · {benefit}
                </li>
              ))}
            </ul>
          </SectionBlock>
        )}

        {isEmpty && (
          <p className={NORMALIZED_MUTED}>
            The normalized offer is empty — the AI service found no content to extract.
          </p>
        )}
      </div>

      <div className="xl:col-span-4 min-w-0">
        <NormalizedSheetRail stats={offerSheetStats(offer)} />
      </div>
    </div>
  );
}
