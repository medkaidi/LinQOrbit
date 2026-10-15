"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { isAxiosError } from "axios";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RetryButton } from "@/features/admin/retry-button";
import { SpecGrid, type SpecCell } from "@/features/admin/normalized/normalized-spec-grid";
import {
  NORMALIZED_MUTED,
  formatDateTime,
} from "@/features/admin/normalized/normalized-shared";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AdminNormalizedProfile } from "@/types/admin";

/** 404 = jamais validé (état explicite) — partagé avec la carte CTA. */
export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

/**
 * Actions JSON de la fiche : copie dans le presse-papiers (retour « Copied »
 * 2 s) et téléchargement du contenu de la version affichée en `.json`. Les
 * deux ne servent que quand un contenu existe (D33 : jamais de JSON brut
 * affiché — le JSON reste une action, pas un rendu).
 */
function JsonActions<T>({ content, version }: { content: T; version: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `normalized-profile-v${version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Unification CTA plateforme (D39 retours) : actions JSON en CtaButton grise. */}
      <CtaButton
        icon={copied ? "check" : "content_copy"}
        tone="neutral"
        onClick={handleCopy}
        aria-label={copied ? "JSON copied to clipboard" : "Copy JSON"}
      >
        {copied ? "Copied" : "Copy JSON"}
      </CtaButton>
      <CtaButton
        icon="file_download"
        tone="neutral"
        onClick={handleDownload}
        aria-label="Download JSON"
      >
        Download JSON
      </CtaButton>
    </>
  );
}

/** Cellules du bandeau d'identité — partagées avec la carte CTA des pages détail. */
export function identityCells<T>(profile: AdminNormalizedProfile<T>): SpecCell[] {
  const statusTone =
    profile.jobStatus === "done"
      ? "success"
      : profile.jobStatus === "failed"
        ? "error"
        : undefined;
  return [
    { label: "Profile ID", value: profile.profileId, mono: true },
    { label: "Version", value: `v${profile.version}`, mono: true, tone: "primary" },
    { label: "Schema", value: profile.schemaVersion, mono: true },
    { label: "Validated", value: formatDateTime(profile.validatedAt), mono: true },
    { label: "Status", value: profile.jobStatus, mono: true, tone: statusTone },
  ];
}

/**
 * Enveloppe « Normalized profile » (D33) : bandeau d'identité réel (profileId,
 * version, schema, horodatage, statut + actions Copy/Download JSON, slot
 * `actions` pour l'historique des versions) + états — jamais validé (404),
 * analyse en cours, échec, contenu vide — puis le contenu via `children`
 * (vue friendly, jamais de JSON brut).
 */
export function NormalizedProfileSection<T>({
  isLoading,
  isError,
  error,
  profile,
  onRetry,
  actions,
  panel,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  profile: AdminNormalizedProfile<T> | undefined;
  onRetry: () => void;
  /** Actions d'en-tête supplémentaires (bouton History de la page dédiée). */
  actions?: ReactNode;
  /** Région repliable au premier plan du corps (panneau History ouvert). */
  panel?: ReactNode;
  children: (content: T) => ReactNode;
}) {
  const neverValidated = isError && isNotFound(error);

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className="mx-4 pt-4 pb-4 border-b border-slate-border flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0">
            Normalized profile
          </h2>
          {(profile?.content != null || actions) && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {profile?.content != null && (
                <JsonActions content={profile.content} version={profile.version} />
              )}
              {actions}
            </div>
          )}
        </div>
        {profile && <SpecGrid cells={identityCells(profile)} />}
      </header>
      <div className="px-4 pt-4 pb-5 flex flex-col gap-3">
        {panel}
        {isLoading && (
          <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading normalized profile…
          </div>
        )}
        {neverValidated && (
          <p className={NORMALIZED_MUTED}>
            No normalized profile has been produced yet — validate the element to run the AI
            analysis.
          </p>
        )}
        {isError && !neverValidated && (
          <Alert variant="error" title="Unable to load the normalized profile">
            {getApiErrorMessage(error)}{" "}
            <RetryButton onRetry={onRetry} label="Try again" />
          </Alert>
        )}
        {profile && profile.jobStatus === "failed" && (
          <Alert variant="error" title="Normalization failed">
            The AI analysis failed after several attempts. Re-validate the element to run it again.
          </Alert>
        )}
        {profile && (profile.jobStatus === "pending" || profile.jobStatus === "running") && (
          <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            The AI analysis is still running — the content will appear here once it completes.
          </div>
        )}
        {profile && profile.content === null &&
          profile.jobStatus !== "failed" &&
          profile.jobStatus !== "pending" &&
          profile.jobStatus !== "running" && (
            <p className={NORMALIZED_MUTED}>
              The normalization job completed but produced no content.
            </p>
          )}
        {profile && profile.content !== null && children(profile.content)}
      </div>
    </section>
  );
}
