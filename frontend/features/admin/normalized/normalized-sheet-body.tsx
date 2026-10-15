"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NormalizedCandidateView } from "@/features/admin/normalized/normalized-candidate-view";
import { NormalizedHistoryPanel } from "@/features/admin/normalized/normalized-history-panel";
import { NormalizedOfferView } from "@/features/admin/normalized/normalized-offer-view";
import { NormalizedProfileSection } from "@/features/admin/normalized/normalized-profile-section";
import { NORMALIZED_MUTED } from "@/features/admin/normalized/normalized-shared";
import { RetryButton } from "@/features/admin/retry-button";
import {
  useAdminJobOffer,
  useAdminOfferNormalized,
  useAdminOfferNormalizedVersions,
  useAdminUserDetail,
  useAdminUserNormalized,
  useAdminUserNormalizedVersions,
} from "@/hooks/use-admin";
import type { AdminNormalizedProfile } from "@/types/admin";
import type { NormalizedCandidateProfile, NormalizedJobOffer } from "@/types/normalized";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

type SheetKind = "user" | "offer";
type SheetContent = NormalizedCandidateProfile | NormalizedJobOffer;

/**
 * Corps de la fiche normalisée (D37, ex-page dédiée) : rendu **seul** de la
 * fiche — états (détail en chargement/erreur, jamais validé, sans profil
 * candidat), bandeau d'identité + actions JSON, panneau History lazy (toutes
 * les versions — sélection = affichage de cette version avec badge
 * « Viewing v… — current is v… » + retour à la version courante) et vue
 * friendly. Une seule implémentation pour les deux kinds : consommé par le
 * drawer de comparaison (D39).
 */
export function NormalizedSheetBody({ kind, id }: { kind: SheetKind; id: string }) {
  const isUser = kind === "user";
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);

  const userDetail = useAdminUserDetail(isUser ? id : undefined);
  const offerDetail = useAdminJobOffer(isUser ? undefined : id);
  const userCurrent = useAdminUserNormalized(isUser ? id : undefined);
  const offerCurrent = useAdminOfferNormalized(isUser ? undefined : id);
  const userVersions = useAdminUserNormalizedVersions(isUser ? id : undefined, {
    enabled: historyOpen,
  });
  const offerVersions = useAdminOfferNormalizedVersions(isUser ? undefined : id, {
    enabled: historyOpen,
  });

  const detail = isUser ? userDetail : offerDetail;
  const current = isUser ? userCurrent : offerCurrent;
  const versions = isUser ? userVersions : offerVersions;

  const user = isUser ? userDetail.data : undefined;
  const hasCandidateProfile = user?.hasCandidateProfile;

  const currentProfile: AdminNormalizedProfile<SheetContent> | undefined = isUser
    ? userCurrent.data
    : offerCurrent.data;
  const versionList: AdminNormalizedProfile<SheetContent>[] =
    (isUser ? userVersions.data : offerVersions.data) ?? [];
  const displayed =
    selectedVersion === undefined
      ? currentProfile
      : (versionList.find((version) => version.version === selectedVersion) ??
        currentProfile);
  const viewingOldVersion =
    displayed !== undefined &&
    currentProfile !== undefined &&
    displayed.version !== currentProfile.version;

  if (detail.isLoading) {
    return <p className={MUTED}>Loading…</p>;
  }

  if (detail.isError || !detail.data) {
    return (
      <Alert variant="error" title="Unable to load the element">
        The element could not be loaded.{" "}
        <RetryButton onRetry={() => void detail.refetch()} label="Try again" />
      </Alert>
    );
  }

  const selectVersion = (version: number) => {
    setSelectedVersion(version === currentProfile?.version ? undefined : version);
  };

  return (
    <div className="flex flex-col gap-6">
      {isUser && hasCandidateProfile === false && (
        <p className={NORMALIZED_MUTED}>
          This account has no candidate profile — no normalized sheet to display.
        </p>
      )}
      {(!isUser || hasCandidateProfile !== false) && (
        <NormalizedProfileSection<SheetContent>
          isLoading={current.isLoading}
          isError={current.isError}
          error={current.error}
          profile={displayed}
          onRetry={() => void current.refetch()}
          actions={
            currentProfile && (
              <>
                {viewingOldVersion && displayed && (
                  <span className="rounded-full border border-primary-fixed-dim bg-orange-subtle px-2.5 py-1 text-xs font-bold text-orange-deep">
                    Viewing v{displayed.version} — current is v{currentProfile.version}
                  </span>
                )}
                {viewingOldVersion && (
                  <Button
                    variant="outline-sm"
                    onClick={() => setSelectedVersion(undefined)}
                  >
                    Back to current
                  </Button>
                )}
                <Button
                  variant="outline-sm"
                  aria-expanded={historyOpen}
                  aria-controls="normalized-history-panel"
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  History
                </Button>
              </>
            )
          }
          panel={
            historyOpen && (
              <div id="normalized-history-panel">
                <NormalizedHistoryPanel
                  isLoading={versions.isLoading}
                  isError={versions.isError}
                  error={versions.error}
                  onRetry={() => void versions.refetch()}
                  versions={versionList}
                  currentVersion={currentProfile?.version}
                  selectedVersion={displayed?.version}
                  onSelect={selectVersion}
                />
              </div>
            )
          }
        >
          {(content) =>
            kind === "user" ? (
              <NormalizedCandidateView
                profile={content as NormalizedCandidateProfile}
              />
            ) : (
              <NormalizedOfferView offer={content as NormalizedJobOffer} />
            )
          }
        </NormalizedProfileSection>
      )}
    </div>
  );
}
