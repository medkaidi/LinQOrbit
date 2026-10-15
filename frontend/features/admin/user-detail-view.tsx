"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NORMALIZED_MUTED, SHEET_HALF_PAD } from "@/features/admin/normalized/normalized-shared";
import { NormalizedSheetCta } from "@/features/admin/normalized/normalized-sheet-cta";
import { NormalizedSheetDrawer } from "@/features/admin/normalized/normalized-sheet-drawer";
import { RetryButton } from "@/features/admin/retry-button";
import { ProfileSections } from "@/features/candidate/profile-view";
import { fullName } from "@/features/candidate/profile-shared";
import {
  useAdminUserDetail,
  useAdminUserProfile,
  useAdminUserNormalized,
  useUpdateUserStatus,
} from "@/hooks/use-admin";
import { useSheetQueryParam } from "@/hooks/use-sheet-query-param";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils/cn";
import { getApiErrorMessage } from "@/lib/utils/api-error";
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
 * (jamais le hash), badges, activation / désactivation, sections du profil
 * professionnel en lecture seule (D38, sans CTA d'édition), carte CTA ouvrant
 * le drawer de comparaison de la fiche normalisée (D37/D39).
 */
export function UserDetailView({ userId }: { userId: string }) {
  const currentUser = useAuthStore((state) => state.user);
  const detail = useAdminUserDetail(userId);
  const profile = useAdminUserProfile(userId);
  const normalized = useAdminUserNormalized(userId);
  const statusMutation = useUpdateUserStatus();
  const [sheetOpen, setSheetOpen] = useSheetQueryParam();

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
    <div
      className={cn(
        "flex flex-col gap-6",
        // Drawer ouvert (D39) : le contenu se réduit à la zone visible —
        // jamais recouvert par le panneau fixed.
        sheetOpen && SHEET_HALF_PAD,
      )}
    >
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
        <>
          <div>
            <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
              Professional profile
            </h2>
            <p className={`${MUTED} mt-1`}>
              Read-only — the candidate&apos;s own profile view.
            </p>
          </div>
          {profile.isLoading && <p className={MUTED}>Loading profile…</p>}
          {profile.isError && (
            <Alert variant="error" title="Unable to load the professional profile">
              {getApiErrorMessage(profile.error)}{" "}
              <RetryButton onRetry={() => void profile.refetch()} label="Try again" />
            </Alert>
          )}
          {/* CTA remonté juste au-dessus de « Personal Information » (retour UI). */}
          <NormalizedSheetCta
            isLoading={normalized.isLoading}
            isError={normalized.isError}
            error={normalized.error}
            profile={normalized.data}
            onRetry={() => void normalized.refetch()}
            onOpen={() => setSheetOpen(true)}
          />
          {profile.data && (
            <ProfileSections
              profile={profile.data}
              account={account}
              readOnly
              compact={sheetOpen}
            />
          )}
        </>
      )}
      {!account.hasCandidateProfile && (
        <p className={NORMALIZED_MUTED}>
          This account has no candidate profile — no normalized sheet to display.
        </p>
      )}
      {sheetOpen && (
        <NormalizedSheetDrawer
          kind="user"
          id={userId}
          entityLabel={fullName(account) || account.email}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
