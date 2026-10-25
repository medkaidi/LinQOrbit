"use client";

import Link from "next/link";

import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, CtaLink } from "@/components/ui/button";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { appliedOnLabel } from "@/features/application/application-shared";
import { companyInitials } from "@/features/job-offer/job-offer-shared";
import { useMyInvitations } from "@/hooks/use-invitations";
import { cn } from "@/lib/utils/cn";
import type { CandidateInvitation } from "@/types/invitation";

function InvitationCard({ invitation }: { invitation: CandidateInvitation }) {
  const { job } = invitation;
  const jobPath = `/jobs/${job.publicId}-${job.slug}`;
  const invitedOn = appliedOnLabel(invitation.invitedAt);
  const mark =
    companyInitials(job.companyName ?? "") || job.title.trim().charAt(0).toUpperCase() || "?";

  return (
    <li className="rounded-2xl border border-slate-border bg-canvas-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-surface text-body-md font-bold text-blue-deep"
          >
            {mark}
          </span>
          <div className="min-w-0">
            <Link
              href={jobPath}
              className={cn(
                LINK_ACCENT_CLASS,
                "font-headline-md text-headline-md text-text-primary font-bold tracking-tight",
              )}
            >
              {job.title}
            </Link>
            {job.companyName ? (
              <p className="truncate font-label-md text-label-md uppercase tracking-wider text-text-secondary">
                {job.companyName}
              </p>
            ) : null}
            {invitedOn ? (
              <p className="mt-1 font-body-sm text-body-sm text-text-tertiary">
                Invited {invitedOn}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink variant="outline-sm" href={jobPath}>
            View job
          </ButtonLink>
          <CtaLink icon="bolt" href={`${jobPath}/apply`}>
            Apply
          </CtaLink>
        </div>
      </div>
    </li>
  );
}

/**
 * Invitations à candidater reçues (T-101, D85), en tête de « My applications » :
 * l'offre et la date seulement — ni le recruteur, ni le rang du screening. La
 * section n'existe que s'il y a au moins une invitation ouverte ; une
 * candidature (même brouillon) retire l'invitation, le serveur ne la renvoie plus.
 */
export function InvitationsSection() {
  const invitations = useMyInvitations();
  const items = invitations.data ?? [];

  if (invitations.isError) {
    return (
      <Alert variant="error" title="Could not load your invitations">
        Reload the page to try again.
      </Alert>
    );
  }
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={SECTION_CARD_CLASS} aria-label="Invitations">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Invitations</h2>
        <span className={MUTED_TEXT_CLASS}>
          {items.length === 1 ? "1 invitation" : `${items.length} invitations`}
        </span>
      </header>
      <div className="px-6 pt-5 pb-6">
        <p className={cn(MUTED_TEXT_CLASS, "mb-4")}>
          Employers invited you to apply to these offers. You decide whether to apply.
        </p>
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map((invitation) => (
            <InvitationCard key={invitation.id} invitation={invitation} />
          ))}
        </ul>
      </div>
    </section>
  );
}
