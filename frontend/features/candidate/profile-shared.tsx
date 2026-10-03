import type { CandidateProfile } from "@/lib/api/candidate.api";
import { Alert } from "@/components/ui/alert";

/**
 * Descriptions de section, partagées par l'affichage et l'édition pour que les
 * deux pages restent alignées (même intitulé, même phrase d'accroche).
 */
export const SECTION_DESCRIPTIONS = {
  about: "Your headline and summary. Recruiters read this first.",
  experiences: "Your work history, most recent first. Saved as a full list.",
  education: "Degrees, schools and field of study. Saved as a full list.",
  skills: "Hard and soft skills, with the level you would claim in an interview.",
  languages: "Languages you work in, with the CEFR level you would claim.",
  links: "Portfolio, social profiles and the certifications you hold.",
  goals: "Contract, salary, rhythm and scope you are after.",
} as const;


/**
 * Les 6 sections du profil, avec les mêmes règles que le backend
 * (`CandidateService.computeCompletion`) : About complet = titre + bio.
 */
export function countCompletedSections(profile: CandidateProfile): number {
  return [
    Boolean(profile.about.title?.trim() && profile.about.bio?.trim()),
    profile.experiences.length > 0,
    profile.diplomas.length > 0,
    profile.skills.length > 0,
    profile.languages.length > 0,
    profile.links.length > 0,
  ].filter(Boolean).length;
}

export function CompletenessCard({ profile }: { profile: CandidateProfile }) {
  const completedSections = countCompletedSections(profile);
  const completion = profile.completionPercentage;

  return (
    <section className="bg-canvas-white rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Profile completeness
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
            {completedSections} of 6 sections complete. A profile with substance gets more
            replies.
          </p>
        </div>
        <span className="font-headline-lg text-headline-lg font-bold text-orange-deep">
          {completion}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Profile completeness"
        aria-valuenow={completion}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 h-2 w-full rounded-full bg-canvas-subtle overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-primary-container transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${completion}%` }}
        />
      </div>
    </section>
  );
}

export function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading profile"
      className="bg-canvas-white rounded-2xl p-6 shadow-sm animate-pulse motion-reduce:animate-none"
    >
      <div className="h-5 w-56 rounded-full bg-canvas-subtle" />
      <div className="mt-4 h-4 w-full rounded-full bg-canvas-subtle" />
      <div className="mt-2 h-4 w-2/3 rounded-full bg-canvas-subtle" />
      <div className="mt-6 h-24 w-full rounded-2xl bg-canvas-subtle" />
      <div className="mt-3 h-24 w-full rounded-2xl bg-canvas-subtle" />
      <span className="sr-only">Loading profile…</span>
    </div>
  );
}

export function ProfileError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="error" title="Unable to load your profile" className="mt-0">
      <span className="flex flex-wrap items-center gap-3">
        Something went wrong while fetching your profile.
        <button
          type="button"
          onClick={onRetry}
          className="font-label-md text-label-md text-error underline underline-offset-2 cursor-pointer"
        >
          Try again
        </button>
      </span>
    </Alert>
  );
}
