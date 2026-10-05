"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { countryOptions } from "@/config/countries";
import { useAccount } from "@/hooks/use-account";
import type { AuthUser } from "@/lib/api/auth.api";

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

function countryLabel(code: string): string {
  return countryOptions.find((option) => option.value === code)?.label ?? code;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas-subtle p-3">
      <dt className="font-label-md text-label-md text-text-secondary">{label}</dt>
      <dd className="mt-1 text-body-md font-body-md text-text-primary font-bold break-words">
        {value}
      </dd>
    </div>
  );
}

function initialsOf(user: AuthUser) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

export function AccountView() {
  const { account, isLoading, isError, refetch } = useAccount();

  if (!account) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            My account
          </h1>
        </div>
        {isError ? (
          <Alert variant="error" title="Unable to load your account" className="mt-0">
            <span className="flex flex-wrap items-center gap-3">
              Something went wrong while fetching your account.
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </span>
          </Alert>
        ) : (
          <div
            role="status"
            aria-busy="true"
            className="bg-canvas-white rounded-2xl p-6 shadow-sm animate-pulse motion-reduce:animate-none"
          >
            <div className="h-5 w-40 rounded-full bg-canvas-subtle" />
            <div className="mt-4 h-4 w-full rounded-full bg-canvas-subtle" />
            <div className="mt-2 h-4 w-2/3 rounded-full bg-canvas-subtle" />
          </div>
        )}
        {isLoading ? <span className="sr-only">Loading account…</span> : null}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          My account
        </h1>
        <p className="mt-1 text-body-md font-body-md text-text-secondary">
          Your account details as stored on LinQOrbit.
        </p>
      </div>

      <section className="bg-canvas-white rounded-2xl shadow-sm divide-y divide-slate-border">
        <div className="p-6 flex items-center gap-4 min-w-0">
          <span className="w-16 h-16 rounded-full bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-headline-md font-bold shrink-0">
            {initialsOf(account)}
          </span>
          <div className="min-w-0">
            <p className="font-headline-md text-headline-md text-text-primary font-bold truncate">
              {account.firstName} {account.lastName}
            </p>
            <p className="text-body-md font-body-md text-text-secondary truncate">
              {account.email}
            </p>
          </div>
        </div>

        <div className="p-6">
          <h2 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
            Personal information
          </h2>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Field label="First name" value={account.firstName} />
            <Field label="Last name" value={account.lastName} />
            <Field label="Phone" value={account.phone?.trim() || "Not provided"} />
            <Field label="Sex" value={SEX_LABELS[account.sex] ?? account.sex} />
          </dl>
        </div>

        <div className="p-6">
          <h2 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
            Location
          </h2>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <Field label="Current city" value={account.currentCity} />
            <Field label="Current country" value={countryLabel(account.currentCountry)} />
            <Field label="Country of origin" value={countryLabel(account.homeCountry)} />
          </dl>
        </div>

        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
              Security
            </h2>
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
              Manage how you sign in to LinQOrbit.
            </p>
          </div>
          <Link
            href="/change-password"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg transition-[background-color,scale] duration-150 ease-out active:scale-[0.97]"
          >
            <Icon name="lock" className="text-[18px]" />
            Change password
          </Link>
        </div>
      </section>

      {isError ? (
        <Alert variant="error" title="Account may be out of date" className="mt-0">
          We could not refresh your account from the server.
        </Alert>
      ) : null}
    </div>
  );
}
