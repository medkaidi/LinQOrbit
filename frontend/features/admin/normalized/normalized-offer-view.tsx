import { Badge } from "@/components/ui/badge";
import {
  NORMALIZED_BLOCK_TITLE,
  NORMALIZED_ITEM_CARD,
  NORMALIZED_MUTED,
  SENIORITY_LABELS,
} from "@/features/admin/normalized/normalized-shared";
import { NormalizedSkillRow } from "@/features/admin/normalized/normalized-skill-row";
import type {
  NormalizedJobOffer,
  NormalizedResponsibility,
  OfferRequirementEntry,
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
      <Badge tone={entry.source === "inferred" ? "neutral" : "success"}>
        {entry.source === "inferred" ? "Inferred" : "Declared"}
      </Badge>
    </li>
  );
}

/**
 * Fiche normalisée offre schema v2 (D35) : rendu friendly du contenu
 * canonique — jamais de JSON brut. Tolère tout champ absent ou null.
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

  const headerBits = [
    offer.domain,
    offer.contractType ? CONTRACT_TYPE_LABELS[offer.contractType] ?? offer.contractType : null,
    offer.workTime ? WORK_TIME_LABELS[offer.workTime] ?? offer.workTime : null,
    offer.seniority ? SENIORITY_LABELS[offer.seniority] ?? offer.seniority : null,
    offer.workMode ? WORK_MODE_LABELS[offer.workMode] ?? offer.workMode : null,
    offer.location
      ? [offer.location.city, offer.location.country].filter(Boolean).join(", ") || null
      : null,
    offer.salary
      ? [
          offer.salary.min != null || offer.salary.max != null
            ? [
                offer.salary.min != null
                  ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(offer.salary.min)
                  : null,
                offer.salary.max != null
                  ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(offer.salary.max)
                  : null,
              ]
                .filter(Boolean)
                .join(" – ")
            : null,
          offer.salary.currency,
          offer.salary.period ? `per ${offer.salary.period}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <div className="flex flex-col gap-6">
      <header>
        {offer.title && (
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            {offer.title}
          </h3>
        )}
        {headerBits.length > 0 && (
          <p className={`${NORMALIZED_MUTED} mt-1`}>{headerBits.join(" · ")}</p>
        )}
        {alternateTitles.length > 0 && (
          <p className={`${NORMALIZED_MUTED} mt-1`}>Also known as: {alternateTitles.join(", ")}</p>
        )}
        {offer.summary && (
          <p className="mt-3 text-body-md font-body-md text-text-primary leading-relaxed">
            {offer.summary}
          </p>
        )}
      </header>

      {offer.companyPitch && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Company</h4>
          <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed">
            {offer.companyPitch}
          </p>
        </section>
      )}

      {offer.description && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Description</h4>
          <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed whitespace-pre-line">
            {offer.description}
          </p>
        </section>
      )}

      {responsibilities.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Responsibilities</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {responsibilities.map((responsibility, index) => (
              <ResponsibilityItem key={index} responsibility={responsibility} />
            ))}
          </ul>
        </section>
      )}

      {requiredSkills.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Required skills</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {requiredSkills.map((requirement, index) => (
              <NormalizedSkillRow key={index} skill={requirement} />
            ))}
          </ul>
        </section>
      )}

      {preferredSkills.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Preferred skills</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {preferredSkills.map((requirement, index) => (
              <NormalizedSkillRow key={index} skill={requirement} />
            ))}
          </ul>
        </section>
      )}

      {offer.requiredYears != null && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Required experience</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary">
              {offer.requiredYears}+ yrs total
            </span>
            {offer.requiredYearsSource && (
              <Badge tone={offer.requiredYearsSource === "inferred" ? "neutral" : "success"}>
                {offer.requiredYearsSource === "inferred" ? "Inferred" : "Declared"}
              </Badge>
            )}
          </div>
        </section>
      )}

      {requiredDegrees.length > 0 || requiredStudyFields.length > 0 ? (
        <section>
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
        </section>
      ) : null}

      {languages.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Languages</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
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
                {language.origin && (
                  <Badge tone={language.origin === "inferred" ? "neutral" : "success"}>
                    {language.origin === "inferred" ? "Inferred" : "Declared"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {certifications.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Certifications</h4>
          <ul className="mt-2 flex flex-col gap-3">
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
        </section>
      )}

      {benefits.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Benefits</h4>
          <ul className="mt-2 flex flex-col gap-1">
            {benefits.map((benefit, index) => (
              <li key={index} className="text-body-sm font-body-sm text-text-primary">
                · {benefit}
              </li>
            ))}
          </ul>
        </section>
      )}

      {responsibilities.length === 0 &&
        requiredSkills.length === 0 &&
        preferredSkills.length === 0 &&
        requiredDegrees.length === 0 &&
        requiredStudyFields.length === 0 &&
        languages.length === 0 &&
        certifications.length === 0 &&
        benefits.length === 0 &&
        offer.requiredYears == null &&
        !offer.summary &&
        !offer.description && (
          <p className={NORMALIZED_MUTED}>
            The normalized offer is empty — the AI service found no content to extract.
          </p>
        )}
    </div>
  );
}
