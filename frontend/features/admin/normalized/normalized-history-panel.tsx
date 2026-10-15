"use client";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { RetryButton } from "@/features/admin/retry-button";
import {
  NORMALIZED_MUTED,
  formatDateTime,
} from "@/features/admin/normalized/normalized-shared";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AdminNormalizedProfile } from "@/types/admin";

function statusClasses(jobStatus: string | null | undefined): string {
  if (jobStatus === "done") {
    return "text-success-text";
  }
  if (jobStatus === "failed") {
    return "text-error";
  }
  return "text-text-secondary";
}

/**
 * Panneau « Version history » (D37) de la fiche dédiée : toutes les versions
 * produites, de la plus récente à la plus ancienne — numéro, schema,
 * horodatage, statut du job. Une version courante marquée ; cliquer une ligne
 * sélectionne cette version pour l'affichage (et la ligne déjà sélectionnée
 * est annoncée via `aria-pressed`).
 */
export function NormalizedHistoryPanel<T>({
  isLoading,
  isError,
  error,
  onRetry,
  versions,
  currentVersion,
  selectedVersion,
  onSelect,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  versions: AdminNormalizedProfile<T>[];
  currentVersion: number | undefined;
  selectedVersion: number | undefined;
  onSelect: (version: number) => void;
}) {
  return (
    <div className="rounded-md border border-slate-border bg-canvas-subtle p-3 flex flex-col gap-3">
      <h3 className="font-label-md text-label-md text-text-secondary">Version history</h3>
      {isLoading && (
        <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
          <Spinner />
          Loading version history…
        </div>
      )}
      {isError && (
        <Alert variant="error" title="Unable to load the version history">
          {getApiErrorMessage(error)}{" "}
          <RetryButton onRetry={onRetry} label="Try again" />
        </Alert>
      )}
      {!isLoading && !isError && versions.length === 0 && (
        <p className={NORMALIZED_MUTED}>No version has been produced yet.</p>
      )}
      {!isLoading && !isError && versions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {versions.map((version) => {
            const selected = selectedVersion === version.version;
            const current = currentVersion === version.version;
            return (
              <li key={version.profileId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(version.version)}
                  className={[
                    "w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-1",
                    "rounded-md border px-3 py-2 text-left cursor-pointer",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
                    selected
                      ? "border-orange-border bg-orange-subtle"
                      : "border-slate-border bg-canvas-white hover:border-slate-muted",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-body-sm font-semibold text-text-primary">
                      v{version.version}
                    </span>
                    {current && (
                      <span className="rounded-full border border-slate-border bg-canvas-subtle px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                        Current
                      </span>
                    )}
                    <span className="font-mono text-xs text-text-tertiary">
                      schema {version.schemaVersion}
                    </span>
                    <span className="font-mono text-xs text-text-tertiary">
                      {formatDateTime(version.validatedAt)}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold ${statusClasses(version.jobStatus)}`}
                  >
                    {version.jobStatus}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
