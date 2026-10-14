import { Badge } from "@/components/ui/badge";
import {
  NORMALIZED_BLOCK_TITLE,
  NORMALIZED_ITEM_CARD,
  NORMALIZED_MUTED,
  PROJECT_CONTEXT_LABELS,
  SENIORITY_LABELS,
  formatMonth,
  formatPeriod,
} from "@/features/admin/normalized/normalized-shared";
import { NormalizedSkillRow } from "@/features/admin/normalized/normalized-skill-row";
import type { NormalizedCandidateProfile } from "@/types/normalized";

function OriginBadge({ origin }: { origin?: string }) {
  if (!origin) {
    return null;
  }
  return (
    <Badge tone={origin === "inferred" ? "neutral" : "success"}>
      {origin === "inferred" ? "Inferred" : "Declared"}
    </Badge>
  );
}

/**
 * Fiche normalisée candidat schema v3 (D36) : rendu friendly du contenu
 * canonique — jamais de JSON brut. Tolère tout champ absent ou null.
 */
export function NormalizedCandidateView({ profile }: { profile: NormalizedCandidateProfile }) {
  const skills = profile.skills ?? [];
  const experiences = profile.experiences ?? [];
  const projects = profile.projects ?? [];
  const diplomas = profile.diplomas ?? [];
  const languages = profile.languages ?? [];
  const certifications = profile.certifications ?? [];
  const links = profile.links ?? [];

  const headerBits = [
    profile.seniority ? SENIORITY_LABELS[profile.seniority] ?? profile.seniority : null,
    profile.yearsOfExperience != null ? `${profile.yearsOfExperience} yrs experience` : null,
    profile.location
      ? [profile.location.city, profile.location.country].filter(Boolean).join(", ") || null
      : null,
    profile.searchStatus ?? null,
    profile.targetRole ?? null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <div className="flex flex-col gap-6">
      <header>
        {profile.title && (
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            {profile.title}
          </h3>
        )}
        {headerBits.length > 0 && (
          <p className={`${NORMALIZED_MUTED} mt-1`}>{headerBits.join(" · ")}</p>
        )}
        {profile.summary && (
          <p className="mt-3 text-body-md font-body-md text-text-primary leading-relaxed">
            {profile.summary}
          </p>
        )}
      </header>

      {experiences.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Experience</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {experiences.map((experience, index) => (
              <li key={index} className={NORMALIZED_ITEM_CARD}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-body-md font-body-md text-text-primary font-semibold">
                    {experience.positionTitle ?? "Experience"}
                    {experience.companyName ? ` · ${experience.companyName}` : ""}
                  </p>
                  <span className={`${NORMALIZED_MUTED} shrink-0`}>
                    {formatPeriod(experience.startDate, experience.endDate)}
                  </span>
                </div>
                {experience.domain && (
                  <p className={`${NORMALIZED_MUTED} mt-1`}>{experience.domain}</p>
                )}
                {experience.description && (
                  <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed">
                    {experience.description}
                  </p>
                )}
                {experience.technologies && experience.technologies.length > 0 && (
                  <p className={`${NORMALIZED_MUTED} mt-2`}>
                    {experience.technologies.join(", ")}
                  </p>
                )}
                {experience.achievements && experience.achievements.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {experience.achievements.map((achievement, achievementIndex) => (
                      <li key={achievementIndex} className="text-body-sm font-body-sm text-text-primary">
                        · {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Projects</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {projects.map((project, index) => (
              <li key={index} className={NORMALIZED_ITEM_CARD}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-body-md font-body-md text-text-primary font-semibold">
                    {project.name ?? "Project"}
                    {project.role ? ` · ${project.role}` : ""}
                  </p>
                  <span className={`${NORMALIZED_MUTED} shrink-0`}>
                    {formatPeriod(project.startDate, project.endDate)}
                  </span>
                </div>
                {project.context && (
                  <p className={`${NORMALIZED_MUTED} mt-1`}>
                    {PROJECT_CONTEXT_LABELS[project.context] ?? project.context}
                  </p>
                )}
                {project.description && (
                  <p className="mt-2 text-body-sm font-body-sm text-text-primary leading-relaxed">
                    {project.description}
                  </p>
                )}
                {project.technologies && project.technologies.length > 0 && (
                  <p className={`${NORMALIZED_MUTED} mt-2`}>{project.technologies.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {diplomas.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Education</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {diplomas.map((diploma, index) => (
              <li key={index} className={NORMALIZED_ITEM_CARD}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-md font-body-md text-text-primary font-semibold">
                    {diploma.title ?? "Diploma"}
                    {diploma.institution ? ` · ${diploma.institution}` : ""}
                  </p>
                  <OriginBadge origin={diploma.origin} />
                </div>
                <p className={`${NORMALIZED_MUTED} mt-1`}>
                  {[
                    diploma.degreeLabel,
                    diploma.studyFieldLabel,
                    formatPeriod(diploma.startDate, diploma.endDate),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                </span>
                <OriginBadge origin={language.origin} />
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-md font-body-md text-text-primary font-semibold">
                    {certification.name ?? "Certification"}
                  </p>
                  <OriginBadge origin={certification.origin} />
                </div>
                <p className={`${NORMALIZED_MUTED} mt-1`}>
                  {[
                    certification.issuer,
                    formatMonth(certification.issuedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Links</h4>
          <ul className="mt-2 flex flex-col gap-2">
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
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h4 className={NORMALIZED_BLOCK_TITLE}>Skills</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {skills.map((skill, index) => (
              <NormalizedSkillRow key={index} skill={skill} />
            ))}
          </ul>
        </section>
      )}

      {skills.length === 0 &&
        experiences.length === 0 &&
        projects.length === 0 &&
        diplomas.length === 0 &&
        languages.length === 0 &&
        certifications.length === 0 &&
        links.length === 0 && (
          <p className={NORMALIZED_MUTED}>
            The normalized profile is empty — the AI service found no content to extract.
          </p>
        )}
    </div>
  );
}
