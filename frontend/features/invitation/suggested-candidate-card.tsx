"use client";

import Link from "next/link";

import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, CtaButton } from "@/components/ui/button";
import { IndexBadge } from "@/components/ui/index-badge";
import { KeySignals, yearsLabel } from "@/components/ui/key-signals";
import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import { candidateInitials } from "@/features/application/recruiter-application-shared";
import { countryLabel } from "@/features/candidate/profile-shared";
import { SENIORITY_LABELS } from "@/features/job-offer/job-offer-shared";
import { cn } from "@/lib/utils/cn";
import type { SuggestedCandidate } from "@/types/invitation";

const FALLBACK_NAME = "Candidate";

/** Nom affiché d'un candidat suggéré (il a consenti à la visibilité de son profil, T-102). */
export function suggestedCandidateName(candidate: SuggestedCandidate): string {
  return `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim() || FALLBACK_NAME;
}

/** Zone d'action : invitation, ou état déjà atteint (invité / a candidaté). */
function CardAction({
  candidate,
  canInvite,
  busy,
  onInvite,
}: {
  candidate: SuggestedCandidate;
  canInvite: boolean;
  busy: boolean;
  onInvite: () => void;
}) {
  if (candidate.status === "applied") {
    return <Badge tone="success">Applied</Badge>;
  }
  if (candidate.status === "invited") {
    return <Badge tone="accent">Invited</Badge>;
  }
  if (!canInvite) {
    return null;
  }
  return (
    <CtaButton icon="send" busy={busy} onClick={onInvite} className="whitespace-nowrap">
      Invite to apply
    </CtaButton>
  );
}

/**
 * Carte d'un candidat suggéré (T-101, D85 ; identité T-102, D86), pensée pour
 * une grille à deux colonnes (maquette `screening_candidates`) : en-tête
 * (monogramme d'initiales, nom en lien vers son profil complet, poste actuel,
 * rang), bande de trois signaux (expérience, séniorité, pays — les seules
 * données de la carte, toujours trois cellules pour aligner les cartes d'une
 * même rangée), compétences en pastilles grises (`MUTED_PILL_CLASS`, comme le job board ; niveau
 * en infobulle), puis un pied aligné à droite comme celui du job board : « View
 * profile » (`ButtonLink` `outline-sm`) puis l'action. Le candidat a consenti : jamais d'e-mail
 * ni de téléphone, le contact passe par l'invitation.
 */
export function SuggestedCandidateCard({
  offerId,
  candidate,
  canInvite,
  busy,
  onInvite,
}: {
  offerId: string;
  candidate: SuggestedCandidate;
  canInvite: boolean;
  busy: boolean;
  onInvite: (candidate: SuggestedCandidate) => void;
}) {
  const name = suggestedCandidateName(candidate);
  const title = candidate.title?.trim() || null;
  const detailHref = `/recruiter/offers/${offerId}/suggestions/${candidate.id}`;
  const seniority = candidate.seniority
    ? (SENIORITY_LABELS[candidate.seniority] ?? candidate.seniority)
    : null;

  return (
    <li className="flex min-w-0 flex-col justify-between gap-4 rounded-3xl border border-slate-border bg-canvas-white p-5 shadow-sm transition-colors hover:border-slate-border-strong">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-surface font-headline-sm text-headline-sm font-bold text-blue-deep"
            >
              {candidateInitials(name)}
            </span>
            <div className="min-w-0">
              <Link
                href={detailHref}
                title={name}
                className={cn(
                  LINK_ACCENT_CLASS,
                  "block truncate font-headline-sm text-headline-sm font-bold tracking-tight",
                )}
              >
                {name}
              </Link>
              {title ? (
                <p
                  title={title}
                  className="mt-0.5 truncate text-[11px] font-semibold text-text-secondary"
                >
                  {title}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <span className="sr-only">Rank {candidate.rank}</span>
            <IndexBadge>{candidate.rank}</IndexBadge>
          </div>
        </div>

        <KeySignals
          signals={[
            {
              icon: "schedule",
              label: "Experience",
              value: candidate.yearsOfExperience !== null ? yearsLabel(candidate.yearsOfExperience) : null,
            },
            { icon: "signal_cellular_alt", label: "Seniority", value: seniority },
            { icon: "location_on", label: "Location", value: countryLabel(candidate.country) },
          ]}
        />

        <ul aria-label="Skills" className="flex min-w-0 flex-wrap content-start items-center gap-2">
          {candidate.skills.length > 0 ? (
            candidate.skills.map((skill) => (
              <li
                key={skill.name}
                title={skill.level !== null ? `Level ${skill.level} of 5` : undefined}
                className={MUTED_PILL_CLASS}
              >
                {skill.name}
              </li>
            ))
          ) : (
            <li className="px-1 py-1 font-body-sm text-body-sm text-text-tertiary">
              No skills listed
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 border-t border-slate-border pt-4">
        <div className="flex items-center gap-2">
          <ButtonLink variant="outline-sm" href={detailHref}>
            View profile
          </ButtonLink>
          <CardAction
            candidate={candidate}
            canInvite={canInvite}
            busy={busy}
            onInvite={() => onInvite(candidate)}
          />
        </div>
      </div>
    </li>
  );
}
