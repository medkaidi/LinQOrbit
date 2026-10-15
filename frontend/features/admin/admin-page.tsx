"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfiniteList } from "@/components/ui/infinite-list";
import { RetryButton } from "@/features/admin/retry-button";
import { SuggestionReviewDialog } from "@/features/admin/suggestion-review-dialog";
import {
  useInfiniteAdminUsers,
  useRejectSkillSuggestion,
  useSkillSuggestions,
  useUpdateUserStatus
} from "@/hooks/use-admin";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE } from "@/lib/utils/roles";
import type { AdminSkillSuggestion, AdminUser } from "@/types/admin";

const SECTION_HEADER =
  "mx-6 pt-4 pb-4 flex items-start justify-between gap-4 border-b border-slate-border";
const SECTION_TITLE =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
const ITEM_CARD =
  "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
const MUTED = "text-body-sm font-body-sm text-text-secondary";

function Header() {
  return (
    <div className="pb-6 border-b border-slate-border">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
      >
        <Link
          href="/dashboard"
          className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        >
          Dashboard
        </Link>
        <span aria-hidden="true" className="text-text-tertiary">
          /
        </span>
        <span className="text-text-primary font-semibold">Administration</span>
      </nav>
      <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
        Administration
      </h1>
    </div>
  );
}

/** Pastille de statut à point coloré (même motif que les cartes offre). */
function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps uppercase tracking-wider font-bold shrink-0 ${
        active ? "bg-success-surface text-success-text" : "bg-slate-surface text-text-secondary"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-tertiary" : "bg-slate-border"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AccountRow({
  account,
  isCurrentUser,
  busy,
  onToggle
}: {
  account: AdminUser;
  isCurrentUser: boolean;
  busy: boolean;
  onToggle: (account: AdminUser) => void;
}) {
  const active = account.status === "ACTIVE";
  const fullName = [account.firstName, account.lastName].filter(Boolean).join(" ");
  const initials =
    [account.firstName, account.lastName]
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";
  return (
    <li
      className={`${ITEM_CARD} flex flex-wrap items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          aria-hidden="true"
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-orange-subtle text-orange-deep font-label-lg text-label-lg font-light"
        >
          {initials}
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm text-text-primary truncate">
              <Link
                href={`/admin/users/${account.id}`}
                className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
              >
                {fullName}
              </Link>
            </h3>
            <StatusPill active={active} />
            {account.roles.includes(ROLE.ADMIN) && (
              <Badge tone="neutral">Admin</Badge>
            )}
            {account.hasCandidateProfile && (
              <Badge tone="neutral">Candidate</Badge>
            )}
            {account.hasRecruiterProfile && (
              <Badge tone="neutral">Recruiter</Badge>
            )}
          </div>
          <p className={`${MUTED} truncate`}>{account.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isCurrentUser ? (
          <span className={MUTED}>Your account</span>
        ) : (
          <Button
            variant="outline-sm"
            busy={busy}
            onClick={() => onToggle(account)}
          >
            {active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </div>
    </li>
  );
}

function AccountsSection() {
  const currentUser = useAuthStore((state) => state.user);
  const users = useInfiniteAdminUsers();
  const statusMutation = useUpdateUserStatus();
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  const total = users.data?.pages[0]?.total ?? 0;

  const toggle = (account: AdminUser) => {
    statusMutation.mutate({
      userId: account.id,
      status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    });
  };

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER}>
        <h2 className={SECTION_TITLE}>Accounts</h2>
        {users.data && (
          <span className={`${MUTED} shrink-0`}>{total} accounts</span>
        )}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        {statusMutation.isError && (
          <Alert variant="error" title="Unable to update the status">
            The account status could not be changed.{" "}
            <RetryButton
              onRetry={() => statusMutation.reset()}
              label="Dismiss"
            />
          </Alert>
        )}
        {users.isError && (
          <Alert variant="error" title="Unable to load accounts">
            <RetryButton onRetry={() => void users.refetch()} label="Try again" />
          </Alert>
        )}
        <InfiniteList
          items={items}
          keyExtractor={(account) => account.id}
          renderItem={(account) => (
            <AccountRow
              account={account}
              isCurrentUser={account.id === currentUser?.id}
              busy={statusMutation.isPending}
              onToggle={toggle}
            />
          )}
          hasNextPage={users.hasNextPage}
          isFetchingNextPage={users.isFetchingNextPage}
          fetchNextPage={() => void users.fetchNextPage()}
          loading={users.isLoading}
          empty={<p className={MUTED}>No accounts.</p>}
        />
      </div>
    </section>
  );
}

function SuggestionsSection() {
  const { data, isLoading, isError, refetch } = useSkillSuggestions();
  const rejectMutation = useRejectSkillSuggestion();
  const [reviewing, setReviewing] = useState<AdminSkillSuggestion | null>(null);

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER}>
        <h2 className={SECTION_TITLE}>Skill suggestions</h2>
        {data && (
          <span className={`${MUTED} shrink-0`}>{data.length} pending</span>
        )}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        {rejectMutation.isError && (
          <Alert variant="error" title="Unable to reject the suggestion">
            The suggestion is still in the queue.{" "}
            <RetryButton
              onRetry={() => rejectMutation.reset()}
              label="Dismiss"
            />
          </Alert>
        )}
        {isLoading && <p className={MUTED}>Loading suggestions…</p>}
        {isError && (
          <Alert variant="error" title="Unable to load suggestions">
            <RetryButton onRetry={() => void refetch()} label="Try again" />
          </Alert>
        )}
        {data && data.length === 0 && (
          <p className={MUTED}>
            No suggestions yet — proposed skills appear here for review.
          </p>
        )}
        {data?.map((suggestion) => {
          const author = [
            suggestion.candidateFirstName,
            suggestion.candidateLastName
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={suggestion.id}
              className={`${ITEM_CARD} flex flex-wrap items-center justify-between gap-4`}
            >
              <div className="min-w-0">
                <p className="text-body-md font-body-md text-text-primary font-semibold truncate">
                  {suggestion.name}
                </p>
                <p className={`${MUTED} truncate`}>
                  by {author || "Unknown candidate"}
                  {suggestion.candidateEmail
                    ? ` · ${suggestion.candidateEmail}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`${MUTED}`}>
                  {suggestion.createdAt.slice(0, 10)}
                </span>
                <Button
                  variant="outline-sm"
                  disabled={rejectMutation.isPending}
                  onClick={() => setReviewing(suggestion)}
                >
                  Review
                </Button>
                <Button
                  variant="outline-sm"
                  busy={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(suggestion.id)}
                >
                  Reject
                </Button>
              </div>
            </li>
          );
        })}
      </div>
      {reviewing && (
        <SuggestionReviewDialog
          suggestion={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </section>
  );
}

/** Administration : comptes (activation / désactivation) + suggestions de compétences. */
export function AdminView() {
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <AccountsSection />
      <SuggestionsSection />
    </div>
  );
}
