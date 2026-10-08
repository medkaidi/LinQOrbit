"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/features/candidate/section-card";
import { IdentityAvatar, SECTION_ICONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { applyCvToAbout, planCvImport } from "@/features/candidate/cv-parsing";
import { useApplyCvImport } from "@/hooks/use-apply-cv-import";
import { useUpdateAbout } from "@/hooks/use-candidate-profile";
import { useAccount, useSaveAboutSection } from "@/hooks/use-account";
import { countryOptions } from "@/config/countries";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import type { SelectOption } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AuthUser } from "@/types/auth";
import type { AboutSection as AboutData, ParsedCv } from "@/types/candidate";
import {
  SEARCH_STATUSES,
  aboutSchema,
  aboutSectionSchema,
  type AboutSectionValues,
  type AboutValues,
} from "@/lib/validations/candidate.schemas";

export const SEARCH_STATUS_LABELS: Record<(typeof SEARCH_STATUSES)[number], string> = {
  open_to_work: "Open to work",
  selective: "Open to the right offer only",
  not_looking: "Not looking right now",
};

const SEARCH_STATUS_OPTIONS: SelectOption[] = SEARCH_STATUSES.map((value) => ({
  value,
  label: SEARCH_STATUS_LABELS[value],
}));

const toAboutDefaults = (about: AboutData): AboutValues => ({
  title: about.title ?? "",
  bio: about.bio ?? "",
  yearsOfExperience: about.yearsOfExperience ?? 0,
  // "" = statut pas encore choisi : le select affiche son placeholder.
  searchStatus: (about.searchStatus ?? "") as AboutValues["searchStatus"],
});

const toAccountDefaults = (account: AuthUser) => ({
  firstName: account.firstName,
  lastName: account.lastName,
  phone: account.phone ?? "",
  currentCity: account.currentCity ?? "",
  currentCountry: account.currentCountry ?? "",
});

/**
 * Section About fusionnée : identité du compte + champs About dans un seul
 * formulaire. Le compte inconnu (/me en échec, session absente) retombe sur
 * le formulaire About seul.
 */
export function AboutSection({
  about,
  cvImport,
}: {
  about: AboutData;
  cvImport?: ParsedCv | null;
}) {
  const { account } = useAccount();

  if (!account) {
    return <AboutForm about={about} cvImport={cvImport} />;
  }
  return <FusedAboutForm account={account} about={about} cvImport={cvImport} />;
}

function SectionShell({
  isComplete,
  isDirty,
  isSaving,
  errorMessage,
  saved,
  onSave,
  onDiscard,
  children,
}: {
  isComplete: boolean;
  isDirty: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  saved: boolean;
  onSave: () => void;
  onDiscard: () => void;
  children: ReactNode;
}) {
  return (
    <SectionCard
      id="about"
      title="Personal Information"
      icon={SECTION_ICONS.about}
      isComplete={isComplete}
      isDirty={isDirty}
      isSaving={isSaving}
      errorMessage={errorMessage}
      successMessage={saved && !isDirty ? "Your changes are live on your profile." : null}
      onSave={onSave}
      onDiscard={onDiscard}
    >
      {children}
    </SectionCard>
  );
}

/** Formulaire About seul (compte inconnu) : sauvegarde PUT /…/about uniquement. */
function AboutForm({
  about,
  cvImport,
}: {
  about: AboutData;
  cvImport?: ParsedCv | null;
}) {
  const mutation = useUpdateAbout();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AboutValues>({
    resolver: zodResolver(aboutSchema),
    defaultValues: toAboutDefaults(about),
  });

  useApplyCvImport(cvImport, (imported) => {
    // keepDefaultValues : l'import rend le formulaire sale pour que Save reste actif.
    reset(applyCvToAbout(toAboutDefaults(about), planCvImport(imported)), {
      keepDefaultValues: true,
    });
    setSaved(false);
  });

  const bio = useWatch({ control, name: "bio" }) ?? "";

  const onSubmit = (values: AboutValues) => {
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
    reset(toAboutDefaults(about));
  };

  return (
    <SectionShell
      isComplete={Boolean(about.title?.trim() && about.bio?.trim())}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      saved={saved}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Current position"
            placeholder="Senior Backend Engineer"
            autoComplete="organization-title"
            error={errors.title?.message}
            {...register("title")}
          />
          <TextField
            label="Years of experience"
            type="number"
            min={0}
            max={60}
            inputMode="numeric"
            placeholder="0"
            error={errors.yearsOfExperience?.message}
            {...register("yearsOfExperience", { valueAsNumber: true })}
          />
        </div>
        <Textarea
          label="About you"
          labelAction={
            <span className="font-body-sm text-body-sm text-text-tertiary">{bio.length}/2000</span>
          }
          placeholder="A short summary of what you do, the problems you solve and the kind of role you are after."
          error={errors.bio?.message}
          {...register("bio")}
        />
        <SelectField
          control={control}
          name="searchStatus"
          label="Search status"
          options={SEARCH_STATUS_OPTIONS}
          placeholder="Select a status"
        />
      </form>
    </SectionShell>
  );
}

/** Formulaire fusionné : identité du compte + About dans un seul Save. */
function FusedAboutForm({
  account,
  about,
  cvImport,
}: {
  account: AuthUser;
  about: AboutData;
  cvImport?: ParsedCv | null;
}) {
  const mutation = useSaveAboutSection();
  const [saved, setSaved] = useState(false);

  const toDefaults = (): AboutSectionValues => ({
    ...toAccountDefaults(account),
    ...toAboutDefaults(about),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AboutSectionValues>({
    resolver: zodResolver(aboutSectionSchema),
    defaultValues: toDefaults(),
  });

  useApplyCvImport(cvImport, (imported) => {
    // keepDefaultValues : l'import rend le formulaire sale sans jamais
    // écraser les champs du compte, absents du CV.
    reset(
      {
        ...toAccountDefaults(account),
        ...applyCvToAbout(toAboutDefaults(about), planCvImport(imported)),
      },
      { keepDefaultValues: true },
    );
    setSaved(false);
  });

  const bio = useWatch({ control, name: "bio" }) ?? "";

  const onSubmit = (values: AboutSectionValues) => {
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
    reset(toDefaults());
  };

  return (
    <SectionShell
      isComplete={Boolean(about.title?.trim() && about.bio?.trim())}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      saved={saved}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center gap-4 lg:col-start-1 lg:row-start-1">
            <IdentityAvatar account={account} withCameraBadge />
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="sm:col-span-2">
                <TextField
                  label="Current position"
                  placeholder="Senior Backend Engineer"
                  autoComplete="organization-title"
                  error={errors.title?.message}
                  {...register("title")}
                />
              </div>
            </div>
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <TextField
              label="Email"
              type="email"
              value={account.email}
              readOnly
              disabled
              autoComplete="email"
            />
          </div>
          <div className="lg:col-start-1 lg:row-start-3">
            <TextField
              label="Phone"
              type="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:col-start-1 lg:row-start-4">
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
          <div className="lg:col-start-2 lg:row-start-2">
            <SelectField
              control={control}
              name="searchStatus"
              label="Search status"
              options={SEARCH_STATUS_OPTIONS}
              placeholder="Select a status"
            />
          </div>
          <div className="lg:col-start-2 lg:row-start-3">
            <TextField
              label="Years of experience"
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              placeholder="0"
              error={errors.yearsOfExperience?.message}
              {...register("yearsOfExperience", { valueAsNumber: true })}
            />
          </div>
        </div>
        <Textarea
          label="About you"
          labelAction={
            <span className="font-body-sm text-body-sm text-text-tertiary">{bio.length}/2000</span>
          }
          placeholder="A short summary of what you do, the problems you solve and the kind of role you are after."
          error={errors.bio?.message}
          {...register("bio")}
        />
      </form>
    </SectionShell>
  );
}
