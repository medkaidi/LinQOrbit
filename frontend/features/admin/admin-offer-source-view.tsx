import { publicJobMetaLine } from "@/features/job-offer/job-offer-shared";
import { ViewSection } from "@/features/candidate/profile-shared";
import type { PublicJob } from "@/types/public-job";
import type { JobOfferSkillOption } from "@/types/recruiter";

const MUTED = "text-body-sm font-body-sm text-text-secondary";
const SUBTITLE = "font-label-md text-label-md text-text-secondary uppercase tracking-wider";

function SkillRow({ skill }: { skill: JobOfferSkillOption }) {
  return (
    <li className="rounded-2xl border border-slate-border bg-item-surface/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-md font-body-md text-text-primary font-semibold">
          {skill.name ?? "Unnamed skill"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={MUTED}>Weight {skill.weight}/5</span>
          {skill.yearsExperience != null && (
            <span className={MUTED}>{skill.yearsExperience}+ yrs</span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Vue « source » du détail offre admin (D38) : l'offre **stockée** en base,
 * dans le même rythme que la vue candidat — chaque section dans sa propre
 * carte blanche (`ViewSection` partagé, arrondis de la vue candidat — la
 * fiche normalisée du drawer garde ses valeurs compactes) — labels résolus
 * (vocabulaires + séniorité via `publicJobMetaLine`), HTML de la description
 * déjà sanitisé en base (D19), skills avec weight / years / requirementType
 * de la BD. Ni responsibilities ni benefits : ces sections n'existent que
 * dans la fiche normalisée (contenu LLM, drawer de comparaison — D39).
 */
export function AdminOfferSourceView({ job }: { job: PublicJob }) {
  const meta = publicJobMetaLine(job);
  const requiredSkills = job.skills.filter((skill) => skill.requirementType === "mandatory");
  const preferredSkills = job.skills.filter((skill) => skill.requirementType !== "mandatory");
  const educationEntries = [
    ...job.degreeLabels.map((label) => ({ kind: "Degree", label })),
    ...job.studyFieldLabels.map((label) => ({ kind: "Field of study", label })),
  ];
  const totalSkills = requiredSkills.length + preferredSkills.length;

  return (
    <div className="flex flex-col gap-6">
      {meta.length > 0 && <p className={MUTED}>{meta.join(" · ")}</p>}

      {job.description && (
        <ViewSection id="offer-description" title="Description" icon="subject">
          <div
            className="job-offer-description text-body-md font-body-md text-text-primary"
            // HTML déjà sanitisé côté serveur/base (D19) — jamais de HTML cru.
            dangerouslySetInnerHTML={{ __html: job.description }}
          />
        </ViewSection>
      )}

      {totalSkills > 0 && (
        <ViewSection
          id="offer-skills"
          title="Skills"
          icon="psychology"
          count={`${requiredSkills.length} required · ${preferredSkills.length} preferred`}
        >
          <div className="flex flex-col gap-6">
            {requiredSkills.length > 0 && (
              <div>
                <h3 className={SUBTITLE}>Required skills</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {requiredSkills.map((skill) => (
                    <SkillRow key={skill.skillId} skill={skill} />
                  ))}
                </ul>
              </div>
            )}
            {preferredSkills.length > 0 && (
              <div>
                <h3 className={SUBTITLE}>Preferred skills</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {preferredSkills.map((skill) => (
                    <SkillRow key={skill.skillId} skill={skill} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ViewSection>
      )}

      {job.languages.length > 0 && (
        <ViewSection
          id="offer-languages"
          title="Languages"
          icon="translate"
          count={`${job.languages.length} ${job.languages.length > 1 ? "languages" : "language"}`}
        >
          <ul className="flex flex-wrap gap-2">
            {job.languages.map((language, index) => {
              const base = [language.name ?? "Language", language.level || null]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={`${language.languageId}-${index}`}
                  className="rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary"
                >
                  {language.isRequired ? base : `${base} (nice-to-have)`}
                </li>
              );
            })}
          </ul>
        </ViewSection>
      )}

      {educationEntries.length > 0 && (
        <ViewSection
          id="offer-education"
          title="Education requirements"
          icon="school"
          count={`${educationEntries.length} ${educationEntries.length > 1 ? "entries" : "entry"}`}
        >
          <ul className="flex flex-wrap gap-2">
            {educationEntries.map(({ kind, label }) => (
              <li
                key={`${kind}:${label}`}
                className="rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 text-body-sm font-body-sm text-text-primary"
              >
                {`${kind}: ${label}`}
              </li>
            ))}
          </ul>
        </ViewSection>
      )}
    </div>
  );
}
