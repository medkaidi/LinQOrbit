"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NormalizedCandidateView } from "@/features/admin/normalized/normalized-candidate-view";
import { NormalizedProfileSection } from "@/features/admin/normalized/normalized-profile-section";
import { NORMALIZED_MUTED } from "@/features/admin/normalized/normalized-shared";
import { RetryButton } from "@/features/admin/retry-button";
import { useAdminUserDetail, useAdminUserNormalized, useUpdateUserStatus } from "@/hooks/use-admin";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE } from "@/lib/utils/roles";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-label-md text-label-md text-text-secondary">{label}</p>
      <p className="mt-1 text-body-md font-body-md text-text-primary">{value || "Not provided"}</p>
    </div>
  );
}

/**
 * Fiche détail d'un compte (D33) : identité complète saisie par l'utilisateur
 * (jamais le hash), badges, activation / désactivation, fiche normalisée.
 */
export function UserDetailView({ userId }: { userId: string }) {
  const currentUser = useAuthStore((state) => state.user);
  const detail = useAdminUserDetail(userId);
  const normalized = useAdminUserNormalized(userId);
  const statusMutation = useUpdateUserStatus();

  if (detail.isLoading) {
    return <p className={MUTED}>Loading account…</p>;
  }

  if (detail.isError || !detail.data) {
    return (
      <Alert variant="error" title="Unable to load the account">
        The account could not be loaded.{" "}
        <RetryButton onRetry={() => void detail.refetch()} label="Try again" />
      </Alert>
    );
  }

  const account = detail.data;
  const active = account.status === "ACTIVE";
  const isCurrentUser = account.id === currentUser?.id;

  const toggle = () => {
    statusMutation.mutate({
      userId: account.id,
      status: active ? "INACTIVE" : "ACTIVE",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
        >
          <Link
            href="/admin"
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            Administration
          </Link>
          <span aria-hidden="true" className="text-text-tertiary">
            /
          </span>
          <span className="text-text-primary font-semibold">
            {[account.firstName, account.lastName].filter(Boolean).join(" ") || account.email}
          </span>
        </nav>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight min-w-0">
            {[account.firstName, account.lastName].filter(Boolean).join(" ") || account.email}
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>
            {account.roles.includes(ROLE.ADMIN) && <Badge tone="neutral">Admin</Badge>}
            {account.hasCandidateProfile && <Badge tone="neutral">Candidate</Badge>}
            {account.hasRecruiterProfile && <Badge tone="neutral">Recruiter</Badge>}
          </div>
        </div>
        <p className={`${MUTED} mt-1`}>{account.email}</p>
      </div>

      {statusMutation.isError && (
        <Alert variant="error" title="Unable to update the status">
          The account status could not be changed.{" "}
          <RetryButton onRetry={() => statusMutation.reset()} label="Dismiss" />
        </Alert>
      )}
      {isCurrentUser ? (
        <p className={MUTED}>This is your own account — status changes are not allowed here.</p>
      ) : (
        <div>
          <Button variant="outline-sm" busy={statusMutation.isPending} onClick={toggle}>
            {active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      )}

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className="mx-6 pt-4 pb-4 border-b border-slate-border">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Account details
          </h2>
        </header>
        <div className="px-6 pt-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Phone" value={account.phone} />
          <Field label="Sex" value={account.sex} />
          <Field
            label="Home country"
            value={account.homeCountry}
          />
          <Field
            label="Current location"
            value={
              [account.currentCity, account.currentCountry].filter(Boolean).join(", ") || null
            }
          />
          <Field label="Created at" value={account.createdAt.slice(0, 10)} />
        </div>
      </section>

      {account.hasCandidateProfile && (
        <NormalizedProfileSection
          isLoading={normalized.isLoading}
          isError={normalized.isError}
          error={normalized.error}
          profile={normalized.data}
          onRetry={() => void normalized.refetch()}
        >
          {(content) => <NormalizedCandidateView profile={content} />}
        </NormalizedProfileSection>
      )}
      {!account.hasCandidateProfile && (
        <p className={NORMALIZED_MUTED}>
          This account has no candidate profile — no normalized sheet to display.
        </p>
      )}
    </div>
  );
}
