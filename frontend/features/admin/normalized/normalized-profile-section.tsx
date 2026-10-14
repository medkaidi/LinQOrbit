"use client";

import type { ReactNode } from "react";

import { isAxiosError } from "axios";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { RetryButton } from "@/features/admin/retry-button";
import { NORMALIZED_MUTED } from "@/features/admin/normalized/normalized-shared";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AdminNormalizedProfile } from "@/types/admin";

const SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-border";
const SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";

function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

function EnvelopeBadges<T>({ profile }: { profile: AdminNormalizedProfile<T> }) {
  const jobTone =
    profile.jobStatus === "done"
      ? "success"
      : profile.jobStatus === "failed"
        ? "neutral"
        : "neutral";
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <Badge tone="neutral">v{profile.version}</Badge>
      <Badge tone="neutral">schema {profile.schemaVersion}</Badge>
      {profile.jobStatus && <Badge tone={jobTone}>{profile.jobStatus}</Badge>}
      <span className={NORMALIZED_MUTED}>validated {profile.validatedAt.slice(0, 10)}</span>
    </div>
  );
}

/**
 * Section « Normalized profile » (D33) : enveloppe (version, schema, statut du
 * job) + états — jamais validé (404), analyse en cours, échec, contenu vide —
 * puis rend le contenu via {@code children} (vue friendly, jamais de JSON brut).
 */
export function NormalizedProfileSection<T>({
  isLoading,
  isError,
  error,
  profile,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  profile: AdminNormalizedProfile<T> | undefined;
  onRetry: () => void;
  children: (content: T) => ReactNode;
}) {
  const neverValidated = isError && isNotFound(error);

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER}>
        <h2 className={SECTION_TITLE}>Normalized profile</h2>
        {profile && <EnvelopeBadges profile={profile} />}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
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
