import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { countryOptions } from "@/config/countries";
import type { AuthUser } from "@/types/auth";
import type { CandidateProfile } from "@/types/candidate";

/** Glyphe Material Symbols de chaque section, d'après la maquette pro_profile.html. */
export const SECTION_ICONS = {
  about: "person",
  cv: "description",
  experiences: "work",
  projects: "layers",
  education: "school",
  skills: "psychology",
  languages: "translate",
  links: "link",
  goals: "tune",
} as const;

/**
 * Suppression d'une ligne de formulaire (Expérience, Éducation, Skill,
 * Language, Link) : CTA compact au tone `neutral` (badge gris, libellé sombre,
 * hover clair façon Discard), identique dans les 5 sections d'édition.
 */
export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <CtaButton type="button" icon="delete" tone="neutral" onClick={onClick}>
      Remove
    </CtaButton>
  );
}

/**
 * Cellule label + valeur (section Personal Information) : le label vit hors du
 * conteneur, la valeur est logée dans un « input simulé » — même forme que les
 * champs d'édition (pill h-11), fond des items des sections (`bg-item-surface/50`).
 */
export function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-label-md text-label-md text-text-secondary">{label}</span>
      <div className="flex h-11 items-center rounded-full border border-slate-border bg-item-surface/50 px-4">
        <p className="truncate text-body-md font-body-md text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export function fullName(account: AuthUser): string {
  return `${account.firstName} ${account.lastName}`.trim();
}

const COUNTRY_LABELS = new Map(countryOptions.map((option) => [option.value, option.label]));

/** Code ISO alpha-2 → libellé anglais ; code inconnu renvoyé tel quel, vide → null. */
export function countryLabel(code: string | null): string | null {
  if (!code) {
    return null;
  }
  return COUNTRY_LABELS.get(code) ?? code;
}

function initialsOf(account: AuthUser): string {
  return `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Photo de profil à venir : avatar à initiales ; sur l'édition, le badge caméra
 * reprend la maquette mais reste désactivé (comme le bouton « Add photo »).
 */
export function IdentityAvatar({
  account,
  withCameraBadge = false,
}: {
  account: AuthUser;
  withCameraBadge?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <span className="w-24 h-24 rounded-full bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-headline-lg font-bold">
        {initialsOf(account)}
      </span>
      {withCameraBadge ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Change photo"
          title="Coming soon"
          className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="photo_camera" className="text-[16px]" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Section d'affichage : même découpage que la carte d'édition (`SectionCard`) —
 * titre `headline-md`, compteur en texte muet à droite, corps en `px-6 pb-6`.
 */
export function ViewSection({
  id,
  title,
  icon,
  count,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${SECTION_CARD_CLASS} scroll-mt-24`}>
      <header className={SECTION_HEADER_CLASS}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBadge icon={icon} />
          <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        </div>
        {count ? (
          <span className="text-body-sm font-body-sm text-text-tertiary shrink-0">{count}</span>
        ) : null}
      </header>
      <div className="px-6 pt-5 pb-6">{children}</div>
    </section>
  );
}


/**
 * Les 7 sections du profil, avec les mêmes règles que le backend
 * (`CandidateService.computeCompletion`) : About complet = titre + bio.
 */
export function countCompletedSections(profile: CandidateProfile): number {
  return [
    Boolean(profile.about.title?.trim() && profile.about.bio?.trim()),
    profile.experiences.length > 0,
    profile.projects.length > 0,
    profile.diplomas.length > 0,
    profile.skills.length > 0,
    profile.languages.length > 0,
    profile.links.length > 0,
  ].filter(Boolean).length;
}

/** Jauge ronde (maquette) : rayon 27 → circonférence ≈ 169.65 (dasharray 169.6). */
const GAUGE_RADIUS = 27;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

export function CompletenessCard({
  profile,
  action,
}: {
  profile: CandidateProfile;
  action?: ReactNode;
}) {
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
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Profile completeness
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary max-w-2xl">
            {completedSections} of 7 sections complete. A profile with substance gets more
            replies.
          </p>
        </div>
        {action ? <div className="shrink-0 ml-auto">{action}</div> : null}
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
