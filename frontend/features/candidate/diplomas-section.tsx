"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { ReferenceError } from "@/features/candidate/reference-error";
import { SectionCard } from "@/features/candidate/section-card";
import { SECTION_ICONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { useReferenceDegrees, useReferenceStudyFields, useUpdateDiplomas } from "@/hooks/use-candidate-profile";
import type { DiplomaItem } from "@/lib/api/candidate.api";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { countryOptions } from "@/config/countries";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  diplomasSchema,
  type DiplomaValues,
  type DiplomasValues,
} from "@/lib/validations/candidate.schemas";

const emptyRow = (): DiplomaValues => ({
  title: "",
  institution: "",
  institutionCountry: "",
  degreeId: "",
  studyFieldId: "",
  startDate: "",
  endDate: "",
});

const toFormItems = (items: DiplomaItem[]): DiplomaValues[] =>
  items.map((item) => ({
    title: item.title,
    institution: item.institution,
    institutionCountry: item.institutionCountry ?? "",
    degreeId: item.degreeId ?? "",
    studyFieldId: item.studyFieldId ?? "",
    startDate: item.startDate,
    endDate: item.endDate ?? "",
  }));

export function DiplomasSection({ diplomas }: { diplomas: DiplomaItem[] }) {
  const mutation = useUpdateDiplomas();
  const degrees = useReferenceDegrees();
  const studyFields = useReferenceStudyFields();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DiplomasValues>({
    resolver: zodResolver(diplomasSchema),
    defaultValues: { items: toFormItems(diplomas) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit = (values: DiplomasValues) => {
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
    reset({ items: toFormItems(diplomas) });
  };

  const degreeOptions = (degrees.data ?? []).map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const studyFieldOptions = (studyFields.data ?? []).map((option) => ({
    value: option.id,
    label: option.label,
  }));

  return (
    <SectionCard
      id="education"
      title="Education"
      icon={SECTION_ICONS.education}
      isComplete={diplomas.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your education list is live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {degrees.isError ? (
          <ReferenceError what="Degree levels" onRetry={() => void degrees.refetch()} />
        ) : null}
        {!degrees.isError && studyFields.isError ? (
          <ReferenceError what="Fields of study" onRetry={() => void studyFields.refetch()} />
        ) : null}

        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No education added yet.
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
                  Education {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="font-body-sm text-body-sm text-error hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Degree title"
                  placeholder="MSc in Computer Science"
                  error={errors.items?.[index]?.title?.message}
                  {...register(`items.${index}.title`)}
                />
                <TextField
                  label="Institution"
                  placeholder="Sorbonne University"
                  error={errors.items?.[index]?.institution?.message}
                  {...register(`items.${index}.institution`)}
                />
                <SelectField
                  control={control}
                  name={`items.${index}.degreeId`}
                  label="Degree level"
                  options={degreeOptions}
                  placeholder="Not specified"
                  disabled={degrees.isLoading}
                  searchable
                />
                <SelectField
                  control={control}
                  name={`items.${index}.studyFieldId`}
                  label="Field of study"
                  options={studyFieldOptions}
                  placeholder="Not specified"
                  disabled={studyFields.isLoading}
                  searchable
                />
                <SelectField
                  control={control}
                  name={`items.${index}.institutionCountry`}
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
                        Empty = ongoing
                      </span>
                    }
                    type="date"
                    error={errors.items?.[index]?.endDate?.message}
                    {...register(`items.${index}.endDate`)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={() => append(emptyRow())}
        >
          Add education
        </Button>
      </form>
    </SectionCard>
  );
}
