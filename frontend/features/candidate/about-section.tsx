"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/features/candidate/section-card";
import { SECTION_ICONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { applyCvToAbout, planCvImport } from "@/features/candidate/cv-parsing";
import { useApplyCvImport } from "@/hooks/use-apply-cv-import";
import { useUpdateAbout } from "@/hooks/use-candidate-profile";
import type { AboutSection, ParsedCv } from "@/lib/api/candidate.api";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import type { SelectOption } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  SEARCH_STATUSES,
  aboutSchema,
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

const toDefaults = (about: AboutSection): AboutValues => ({
  title: about.title ?? "",
  bio: about.bio ?? "",
  yearsOfExperience: about.yearsOfExperience ?? 0,
  // "" = statut pas encore choisi : le select affiche son placeholder.
  searchStatus: (about.searchStatus ?? "") as AboutValues["searchStatus"],
});

export function AboutSection({
  about,
  cvImport,
}: {
  about: AboutSection;
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
    defaultValues: toDefaults(about),
  });

  useApplyCvImport(cvImport, (imported) => {
    // keepDefaultValues : l'import rend le formulaire sale pour que Save reste actif.
    reset(applyCvToAbout(toDefaults(about), planCvImport(imported)), {
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
    reset(toDefaults(about));
  };

  const isComplete = Boolean(about.title?.trim() && about.bio?.trim());

  return (
    <SectionCard
      id="about"
      title="About"
      icon={SECTION_ICONS.about}
      isComplete={isComplete}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your changes are live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Professional title"
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
    </SectionCard>
  );
}
