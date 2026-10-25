"use client";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill";
import { useRetryScreening } from "@/hooks/use-invitations";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { ScreeningSignal } from "@/types/invitation";

/**
 * Pastilles orange à point (T-101) : l'orange attire l'œil sur ce qui demande l'attention du
 * recruteur. Seul « Searching candidates… » est réellement en cours : seul son point
 * pulse (mouvement réduit respecté) ; le résultat est figé, son point est fixe.
 */
const SEARCHING_TONE: StatusPillTone = {
  pill: "bg-orange-subtle text-orange-deep",
  dot: "bg-orange-deep animate-pulse motion-reduce:animate-none",
};
const FOUND_TONE: StatusPillTone = {
  pill: "bg-orange-subtle text-orange-deep",
  dot: "bg-orange-deep",
};

/** Vrai tant que la recherche n'est pas terminée : seul état qui garde le flux SSE ouvert. */
export function isScreeningInProgress(screening: ScreeningSignal | null | undefined): boolean {
  return screening?.status === "pending" || screening?.status === "running";
}

/** Libellé du résultat d'une recherche terminée ; 0 candidat reste un résultat (pas un échec). */
function foundLabel(count: number): string {
  if (count === 0) {
    return "No candidates found";
  }
  return count === 1 ? "1 candidate found" : `${count} candidates found`;
}

/**
 * Signal de la recherche automatique de candidats d'une offre publiée (T-101,
 * D85), commun à la carte de la liste et à la preview : « Searching
 * candidates… » pendant la recherche, « {n} candidate(s) found » une fois
 * terminée (avec « View candidates » quand n > 0), « Search failed » avec
 * « Retry search » — seul état qui propose une relance : une liste déjà
 * affichée n'est jamais rafraîchie. Rien sans recherche (`null` ou `none`).
 */
export function ScreeningBadge({
  offerId,
  screening,
}: {
  offerId: string;
  screening: ScreeningSignal | null | undefined;
}) {
  const retry = useRetryScreening(offerId);

  if (!screening || screening.status === "none") {
    return null;
  }
  if (isScreeningInProgress(screening)) {
    return <StatusPill tone={SEARCHING_TONE}>Searching candidates…</StatusPill>;
  }
  if (screening.status === "failed") {
    return (
      <>
        <Badge tone="neutral">Search failed</Badge>
        <Button
          type="button"
          variant="outline-sm"
          busy={retry.isPending}
          onClick={() => retry.mutate()}
        >
          <Icon name="refresh" className="text-[14px]" />
          Retry search
        </Button>
        {retry.error ? (
          <span role="alert" className="font-body-sm text-body-sm text-error">
            {getApiErrorMessage(retry.error)}
          </span>
        ) : null}
      </>
    );
  }
  const count = screening.candidateCount ?? 0;
  return (
    <>
      {count > 0 ? (
        <StatusPill tone={FOUND_TONE}>{foundLabel(count)}</StatusPill>
      ) : (
        <Badge tone="neutral">{foundLabel(count)}</Badge>
      )}
      {count > 0 ? (
        <ButtonLink variant="outline-sm" href={`/recruiter/offers/${offerId}/suggestions`}>
          <Icon name="group" className="text-[14px]" />
          View candidates
        </ButtonLink>
      ) : null}
    </>
  );
}
