"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  LINK_ACCENT_CLASS,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfiniteList } from "@/components/ui/infinite-list";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { ACCOUNT_STATUS_TONES, AccountBadges } from "@/features/admin/account-badges";
import { RetryButton } from "@/features/admin/retry-button";
import { useInfiniteAdminUsers, useUpdateUserStatus } from "@/hooks/use-admin";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHeaderSearch } from "@/hooks/use-header-search";
import { useAuthStore } from "@/stores/auth-store";
import type { HeaderSearchRole } from "@/stores/header-search-store";
import type { AdminUser } from "@/types/admin";


type StatusFilter = "all" | "active" | "inactive";
type CapabilityFilter = "all" | "candidate" | "recruiter";

const STATUS_FILTER_OPTIONS: SegmentedOption<StatusFilter>[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const CAPABILITY_FILTER_OPTIONS: SegmentedOption<CapabilityFilter>[] = [
  { value: "all", label: "All" },
  { value: "candidate", label: "Candidates" },
  { value: "recruiter", label: "Recruiters" },
];

/** Rôle du champ de recherche du header sur la liste des comptes (T-110, D96) : nom ou e-mail. */
const ACCOUNTS_SEARCH_ROLE: HeaderSearchRole = {
  id: "admin-accounts",
  label: "Search accounts",
  placeholder: "Search by name or email",
  maxLength: 100,
};

function Header() {
  return (
    <PageHeader
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>Accounts</BreadcrumbCurrent>
        </Breadcrumb>
      }
      title="Accounts"
    />
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
      className={`${ITEM_CARD_CLASS} flex flex-wrap items-center justify-between gap-4`}
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
                className={LINK_ACCENT_CLASS}
              >
                {fullName}
              </Link>
            </h3>
            <StatusPill tone={ACCOUNT_STATUS_TONES[active ? "active" : "inactive"]}>
              {active ? "Active" : "Inactive"}
            </StatusPill>
            <AccountBadges account={account} />
          </div>
          <p className={`${MUTED_TEXT_CLASS} truncate`}>{account.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isCurrentUser ? (
          <span className={MUTED_TEXT_CLASS}>Your account</span>
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
  const [search] = useHeaderSearch(ACCOUNTS_SEARCH_ROLE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  const debouncedSearch = useDebouncedValue(search, 300);
  const users = useInfiniteAdminUsers({
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(capabilityFilter !== "all" ? { capability: capabilityFilter } : {}),
  });
  const statusMutation = useUpdateUserStatus();
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  const total = users.data?.pages[0]?.total ?? 0;
  const filtered =
    search.trim() !== "" || statusFilter !== "all" || capabilityFilter !== "all";

  const toggle = (account: AdminUser) => {
    statusMutation.mutate({
      userId: account.id,
      status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    });
  };

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Accounts</h2>
        {users.data && (
          <span className={`${MUTED_TEXT_CLASS} shrink-0`}>{total} accounts</span>
        )}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Filter accounts by status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
          />
          <SegmentedControl
            label="Filter accounts by capability"
            value={capabilityFilter}
            options={CAPABILITY_FILTER_OPTIONS}
            onChange={setCapabilityFilter}
          />
        </div>
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
        {users.isLoading && (
          <p className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Spinner />
            Loading accounts…
          </p>
        )}
        <InfiniteList
          items={items}
          keyExtractor={(account) => account.id}
          renderItem={(account) => (
            <AccountRow
              account={account}
              isCurrentUser={account.id === currentUser?.id}
              busy={statusMutation.isPending && statusMutation.variables?.userId === account.id}
              onToggle={toggle}
            />
          )}
          hasNextPage={users.hasNextPage}
          isFetchingNextPage={users.isFetchingNextPage}
          fetchNextPage={() => void users.fetchNextPage()}
          loading={users.isLoading}
          empty={
            <p className={MUTED_TEXT_CLASS}>
              {filtered ? "No accounts match these filters." : "No accounts."}
            </p>
          }
        />
      </div>
    </section>
  );
}

/** Administration : comptes (activation / désactivation). Les suggestions de compétences ont leur page (T-111). */
export function AdminView() {
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <AccountsSection />
    </div>
  );
}
