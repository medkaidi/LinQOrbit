import type { CandidateProfile } from "@/lib/api/candidate.api";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";

/** Glyphe Material Symbols de chaque section, d'après la maquette pro_profile.html. */
export const SECTION_ICONS = {
  about: "person",
  experiences: "work",
  education: "school",
  skills: "psychology",
  languages: "translate",
  links: "link",
  goals: "tune",
} as const;

/**
 * Pastille d'icône devant le titre : même bleu (accent secondaire) pour toutes
 * les sections. La taille et la graisse du glyphe viennent de la règle
 * `.section-icon` de globals.css — la feuille Google impose 24px/400.
 */
export function SectionIcon({ name }: { name: string }) {
  return (
    <span className="section-icon w-8 h-8 rounded-full bg-blue-surface border border-blue-border text-blue-deep flex items-center justify-center shrink-0">
      <Icon name={name} />
    </span>
  );
}


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

/** Jauge ronde (maquette) : rayon 27 → circonférence ≈ 169.65 (dasharray 169.6). */
const GAUGE_RADIUS = 27;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

export function CompletenessCard({ profile }: { profile: CandidateProfile }) {
  const completedSections = countCompletedSections(profile);
  const completion = profile.completionPercentage;
  const dashOffset = GAUGE_CIRCUMFERENCE * (1 - completion / 100);

  return (
    <section className="bg-canvas-white rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="progressbar"
          aria-label="Profile completeness"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative w-16 h-16 shrink-0"
        >
          <svg viewBox="0 0 64 64" className="w-16 h-16" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r={GAUGE_RADIUS}
              fill="none"
              strokeWidth={3}
              transform="rotate(-90 32 32)"
              className="stroke-slate-surface"
            />
            <circle
              cx="32"
              cy="32"
              r={GAUGE_RADIUS}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              style={{ strokeDashoffset: dashOffset }}
              transform="rotate(-90 32 32)"
              className="stroke-primary-container transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-label-md font-label-md text-text-primary">{completion}%</span>
            <span className="mt-0.5 font-semibold uppercase tracking-wide text-[8px] text-text-tertiary">
              Score
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Profile completeness
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary max-w-2xl">
            {completedSections} of 6 sections complete. A profile with substance gets more
            replies.
          </p>
        </div>
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
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 rounded-full bg-canvas-subtle" />
        <div className="min-w-0 flex-1">
          <div className="h-5 w-56 max-w-full rounded-full bg-canvas-subtle" />
          <div className="mt-3 h-4 w-2/3 rounded-full bg-canvas-subtle" />
        </div>
      </div>
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
