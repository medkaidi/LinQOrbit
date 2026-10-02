"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { countryOptions } from "@/features/auth/countries";
import { me, type AuthUser } from "@/lib/api/auth.api";
import { useAuthStore } from "@/stores/auth-store";

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

export function ProfileView() {
  const storeUser = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: me,
    staleTime: 60_000,
  });

  const profile = data ?? storeUser;

  if (!profile) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="font-headline-lg text-headline-lg text-text-primary font-bold tracking-tight">
            Profile
          </h1>
        </div>
        {isError ? (
          <Alert variant="error" title="Unable to load your profile" className="mt-0">
            <span className="flex flex-wrap items-center gap-3">
              Something went wrong while fetching your profile.
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
        {isLoading ? <span className="sr-only">Loading profile…</span> : null}
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-text-primary font-bold tracking-tight">
          Profile
        </h1>
        <p className="mt-1 text-body-md font-body-md text-text-secondary">
          Your account details as stored on LinQOrbit.
        </p>
      </div>

      <section className="bg-canvas-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-16 h-16 rounded-full bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-headline-md font-bold shrink-0">
              {initialsOf(profile)}
            </span>
            <div className="min-w-0">
              <p className="font-headline-md text-headline-md text-text-primary font-bold truncate">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-body-md font-body-md text-text-secondary truncate">
                {profile.email}
              </p>
            </div>
          </div>
          <Link
            href="/change-password"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg transition-colors"
          >
            <Icon name="lock" className="text-[18px]" />
            Change password
          </Link>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First name" value={profile.firstName} />
          <Field label="Last name" value={profile.lastName} />
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone?.trim() || "Not provided"} />
          <Field label="Sex" value={SEX_LABELS[profile.sex] ?? profile.sex} />
          <Field label="Country of origin" value={countryLabel(profile.homeCountry)} />
          <Field label="Current city" value={profile.currentCity} />
          <Field label="Current country" value={countryLabel(profile.currentCountry)} />
        </dl>
      </section>

      {isError ? (
        <Alert variant="error" title="Profile may be out of date" className="mt-0">
          We could not refresh your profile from the server.
        </Alert>
      ) : null}
    </div>
  );
}
