"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { SECTION_ICONS, ViewSection } from "@/features/candidate/profile-shared";
import { SectionCard } from "@/features/candidate/section-card";
import { SelectField } from "@/features/candidate/select-field";
import { useAccount, useUpdateProfile } from "@/hooks/use-account";
import { countryOptions } from "@/config/countries";
import { Icon } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";
import type { AuthUser } from "@/lib/api/auth.api";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  updateProfileSchema,
  type UpdateProfileValues,
} from "@/lib/validations/auth.schemas";

const COUNTRY_LABELS = new Map(countryOptions.map((option) => [option.value, option.label]));

function countryLabel(code: string): string {
  return COUNTRY_LABELS.get(code) ?? code;
}

function fullName(account: AuthUser): string {
  return `${account.firstName} ${account.lastName}`.trim();
}

function initialsOf(account: AuthUser): string {
  return `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`.toUpperCase();
}

function toDefaults(account: AuthUser): UpdateProfileValues {
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone ?? "",
    currentCity: account.currentCity,
    currentCountry: account.currentCountry,
  };
}

/** Valeur en lecture seule : même boîte que les champs de la page « My account ». */
function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-canvas-subtle p-3 ${className ?? ""}`}>
      <span className="font-label-md text-label-md text-text-secondary">{label}</span>
      <p className="mt-1 text-body-md font-body-md text-text-primary font-bold break-words">
        {value}
      </p>
    </div>
  );
}

/**
 * Photo de profil à venir : avatar à initiales ; sur l'édition, le badge caméra
 * reprend la maquette mais reste désactivé (comme le bouton « Add photo »).
 */
function IdentityAvatar({
  account,
  withCameraBadge = false,
}: {
  account: AuthUser;
  withCameraBadge?: boolean;
}) {
  return (
    <div className="relative self-center sm:self-start shrink-0">
      <span className="w-24 h-24 rounded-2xl bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-headline-lg font-bold">
        {initialsOf(account)}
      </span>
      {withCameraBadge ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Change photo"
          title="Coming soon"
          className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="photo_camera" className="text-[16px]" />
        </button>
      ) : null}
    </div>
  );
}

function IdentitySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading identity"
      className="bg-canvas-white rounded-2xl p-6 shadow-sm animate-pulse motion-reduce:animate-none"
    >
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-24 h-24 rounded-2xl bg-canvas-subtle shrink-0" />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="h-16 rounded-xl bg-canvas-subtle" />
          <div className="h-16 rounded-xl bg-canvas-subtle" />
          <div className="h-16 rounded-xl bg-canvas-subtle" />
          <div className="h-16 rounded-xl bg-canvas-subtle" />
        </div>
      </div>
      <span className="sr-only">Loading identity…</span>
    </div>
  );
}

/** Carte identité en lecture seule (`/profile`) : mêmes cases que l'édition, valeurs fixes. */
export function IdentityCard({ professionalTitle }: { professionalTitle: string | null }) {
  const { account, isLoading } = useAccount();

  if (!account) {
    return isLoading ? <IdentitySkeleton /> : null;
  }

  return (
    <ViewSection id="identity" title="Identity" icon={SECTION_ICONS.identity}>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <IdentityAvatar account={account} />
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <InfoField label="Full name" value={fullName(account)} />
          <InfoField
            label="Professional title"
            value={professionalTitle?.trim() || "Not provided"}
          />
          <InfoField label="Email" value={account.email} />
          <InfoField label="Phone" value={account.phone?.trim() || "Not provided"} />
          <InfoField label="Current city" value={account.currentCity} />
          <InfoField label="Current country" value={countryLabel(account.currentCountry)} />
        </div>
      </div>
    </ViewSection>
  );
}

/** Carte identité éditable (`/profile/edit`) : formulaire autonome, sauvegarde `PUT /auth/me`. */
export function IdentitySection({ professionalTitle }: { professionalTitle: string | null }) {
  const { account, isLoading } = useAccount();

  if (!account) {
    return isLoading ? <IdentitySkeleton /> : null;
  }
  // Le formulaire ne monte qu'une fois le compte connu : défauts corrects dès le premier rendu.
  return <IdentityForm account={account} professionalTitle={professionalTitle} />;
}

function IdentityForm({
  account,
  professionalTitle,
}: {
  account: AuthUser;
  professionalTitle: string | null;
}) {
  const mutation = useUpdateProfile();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: toDefaults(account),
  });

  const onSubmit = (values: UpdateProfileValues) => {
    mutation.mutate(values, {
      onSuccess: () => {
        reset(values);
        setSaved(true);
      },
    });
  };

  const onDiscard = () => {
    mutation.reset();
    setSaved(false);
    reset(toDefaults(account));
  };

  const isComplete = [
    account.firstName,
    account.lastName,
    account.phone,
    account.currentCity,
    account.currentCountry,
  ].every((value) => Boolean(value?.trim()));

  return (
    <SectionCard
      id="identity"
      title="Identity"
      icon={SECTION_ICONS.identity}
      isComplete={isComplete}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your changes are live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <IdentityAvatar account={account} withCameraBadge />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <TextField
              label="First name"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
            <InfoField
              label="Professional title"
              value={professionalTitle?.trim() || "Not provided"}
              className="sm:col-span-2"
            />
            <InfoField label="Email" value={account.email} />
            <TextField
              label="Phone"
              type="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <TextField
              label="Current city"
              autoComplete="address-level2"
              error={errors.currentCity?.message}
              {...register("currentCity")}
            />
            <SelectField
              control={control}
              name="currentCountry"
              label="Current country"
              options={countryOptions}
              placeholder="Select a country"
              searchable
            />
          </div>
        </div>
      </form>
    </SectionCard>
  );
}
