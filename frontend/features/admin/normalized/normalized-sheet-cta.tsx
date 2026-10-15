"use client";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { RetryButton } from "@/features/admin/retry-button";
import { NORMALIZED_MUTED } from "@/features/admin/normalized/normalized-shared";
import {
  identityCells,
  isNotFound,
} from "@/features/admin/normalized/normalized-profile-section";
import { SpecGrid } from "@/features/admin/normalized/normalized-spec-grid";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AdminNormalizedProfile } from "@/types/admin";

/**
 * Carte « Normalized sheet » des pages détail (D37) : invitation à ouvrir la
 * fiche dans le drawer de comparaison (D39) — bandeau d'identité (version,
 * schema, horodatage, statut) + CTA « Open sheet ». Jamais validé (404) →
 * message sans action, autre erreur → alerte avec nouvelle tentative.
 */
export function NormalizedSheetCta<T>({
  isLoading,
  isError,
  error,
  profile,
  onRetry,
  onOpen,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  profile: AdminNormalizedProfile<T> | undefined;
  onRetry: () => void;
  /** Ouvre le drawer de comparaison (état géré par la page appelante). */
  onOpen: () => void;
}) {
  if (isLoading) {
    return <p className={NORMALIZED_MUTED}>Loading normalized sheet…</p>;
  }

  if (isError && isNotFound(error)) {
    return (
      <p className={NORMALIZED_MUTED}>
        No normalized profile has been produced yet — validate the element to run the AI analysis.
      </p>
    );
  }

  if (isError) {
    return (
      <Alert variant="error" title="Unable to load the normalized profile">
        {getApiErrorMessage(error)}{" "}
        <RetryButton onRetry={onRetry} label="Try again" />
      </Alert>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className="mx-6 pt-4 pb-4 border-b border-slate-border flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
          Normalized sheet
        </h2>
        <CtaButton icon="description" tone="secondary" onClick={onOpen}>
          Open sheet
        </CtaButton>
      </header>
      <div className="px-6 pt-5 pb-6">
        <SpecGrid cells={identityCells(profile)} />
      </div>
    </section>
  );
}
