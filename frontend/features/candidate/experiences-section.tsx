"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { SectionCard } from "@/features/candidate/section-card";
import { RemoveButton, SECTION_ICONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { applyCvToExperiences, planCvImport } from "@/features/candidate/cv-parsing";
import { useApplyCvImport } from "@/hooks/use-apply-cv-import";
import { useUpdateExperiences } from "@/hooks/use-candidate-profile";
import type { ExperienceItem, ParsedCv } from "@/types/candidate";
import { CtaButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { countryOptions } from "@/config/countries";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  experiencesSchema,
  type ExperienceValues,
  type ExperiencesValues,
} from "@/lib/validations/candidate.schemas";

const emptyRow = (): ExperienceValues => ({
  positionTitle: "",
  companyName: "",
  companyCountry: "",
  startDate: "",
  endDate: "",
  description: "",
});

const toFormItems = (items: ExperienceItem[]): ExperienceValues[] =>
  items.map((item) => ({
    positionTitle: item.positionTitle,
    companyName: item.companyName,
    companyCountry: item.companyCountry ?? "",
    startDate: item.startDate,
    endDate: item.endDate ?? "",
    description: item.description ?? "",
  }));

export function ExperiencesSection({
  experiences,
  cvImport,
}: {
  experiences: ExperienceItem[];
  cvImport?: ParsedCv | null;
}) {
  const mutation = useUpdateExperiences();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExperiencesValues>({
    resolver: zodResolver(experiencesSchema),
    defaultValues: { items: toFormItems(experiences) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useApplyCvImport(cvImport, (imported) => {
    const plan = planCvImport(imported);
    reset(
      { items: applyCvToExperiences(toFormItems(experiences), plan) },
      { keepDefaultValues: true },
    );
    setSaved(false);
  });

  const onSubmit = (values: ExperiencesValues) => {
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
    reset({ items: toFormItems(experiences) });
  };

  return (
    <SectionCard
      id="experiences"
      title="Experience"
      icon={SECTION_ICONS.experiences}
      isComplete={experiences.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your experience list is live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No experience added yet. Your first entry could be your current role.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-slate-border bg-item-surface/50 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Experience {index + 1}
                </span>
                <RemoveButton onClick={() => remove(index)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Position title"
                  placeholder="Backend Engineer"
                  error={errors.items?.[index]?.positionTitle?.message}
                  {...register(`items.${index}.positionTitle`)}
                />
                <TextField
                  label="Company"
                  placeholder="Nimbus Labs"
                  error={errors.items?.[index]?.companyName?.message}
                  {...register(`items.${index}.companyName`)}
                />
                <SelectField
                  control={control}
                  name={`items.${index}.companyCountry`}
                  label="Country"
                  options={countryOptions}
                  placeholder="Select a country"
                  searchable
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Start date"
                    type="date"
                    error={errors.items?.[index]?.startDate?.message}
                    {...register(`items.${index}.startDate`)}
                  />
                  <TextField
                    label="End date"
                    labelAction={
                      <span className="font-body-sm text-body-sm text-text-tertiary">
                        Empty = current
                      </span>
                    }
                    type="date"
                    error={errors.items?.[index]?.endDate?.message}
                    {...register(`items.${index}.endDate`)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Textarea
                    label="Description"
                    placeholder="What you shipped, the stack you used, the impact you had."
                    error={errors.items?.[index]?.description?.message}
                    {...register(`items.${index}.description`)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <CtaButton
          type="button"
          tone="secondary"
          icon="add"
          className="self-start"
          onClick={() => append(emptyRow())}
        >
          Add experience
        </CtaButton>
      </form>
    </SectionCard>
  );
}
