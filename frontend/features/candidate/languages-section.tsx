"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { ReferenceError } from "@/features/candidate/reference-error";
import { SectionCard } from "@/features/candidate/section-card";
import { SECTION_ICONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { applyCvToLanguages, planCvImport } from "@/features/candidate/cv-parsing";
import { useApplyCvImport } from "@/hooks/use-apply-cv-import";
import { useReferenceLanguages, useUpdateLanguages } from "@/hooks/use-candidate-profile";
import type { LanguageItem, ParsedCv } from "@/lib/api/candidate.api";
import { Button } from "@/components/ui/button";
import type { SelectOption } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  CEFR_LEVELS,
  languagesSchema,
  type LanguageValues,
  type LanguagesValues,
} from "@/lib/validations/candidate.schemas";

export const CEFR_LABELS: Record<(typeof CEFR_LEVELS)[number], string> = {
  A1: "A1 · Beginner",
  A2: "A2 · Elementary",
  B1: "B1 · Intermediate",
  B2: "B2 · Upper intermediate",
  C1: "C1 · Advanced",
  C2: "C2 · Mastery",
};

const LEVEL_OPTIONS: SelectOption[] = CEFR_LEVELS.map((value) => ({
  value,
  label: CEFR_LABELS[value],
}));

const emptyRow = (): LanguageValues => ({
  languageId: "",
  // "" = pas encore choisi : le select affiche son placeholder.
  level: "" as LanguageValues["level"],
});

const toFormItems = (items: LanguageItem[]): LanguageValues[] =>
  items.map((item) => ({
    languageId: item.languageId,
    level: item.level as LanguageValues["level"],
  }));

export function LanguagesSection({
  languages,
  cvImport,
}: {
  languages: LanguageItem[];
  cvImport?: ParsedCv | null;
}) {
  const mutation = useUpdateLanguages();
  const reference = useReferenceLanguages();
  const [saved, setSaved] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<LanguagesValues>({
    resolver: zodResolver(languagesSchema),
    defaultValues: { items: toFormItems(languages) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const rows = useWatch({ control, name: "items" }) ?? [];

  useApplyCvImport(cvImport, (imported) => {
    if (reference.isLoading) {
      return;
    }
    const plan = planCvImport(imported, { languages: reference.data ?? [] });
    reset({ items: applyCvToLanguages(toFormItems(languages), plan) }, { keepDefaultValues: true });
    setSaved(false);
  });

  const onSubmit = (values: LanguagesValues) => {
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
    reset({ items: toFormItems(languages) });
  };

  const referenceOptions = (reference.data ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));

  /** Une langue déjà posée ailleurs dans la liste ne se propose plus. */
  const optionsFor = (index: number): SelectOption[] => {
    const current = rows[index]?.languageId;
    const used = new Set(
      rows.filter((_, position) => position !== index).map((row) => row.languageId),
    );
    return referenceOptions.filter(
      (option) => option.value === current || !used.has(option.value),
    );
  };

  return (
    <SectionCard
      id="languages"
      title="Languages"
      icon={SECTION_ICONS.languages}
      isComplete={languages.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your languages are live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {reference.isError ? (
          <ReferenceError what="Languages" onRetry={() => void reference.refetch()} />
        ) : null}

        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No language added yet.
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
                  Language {index + 1}
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
                <SelectField
                  control={control}
                  name={`items.${index}.languageId`}
                  label="Language"
                  options={optionsFor(index)}
                  placeholder="Select a language"
                  disabled={reference.isLoading}
                  searchable
                />
                <SelectField
                  control={control}
                  name={`items.${index}.level`}
                  label="Level"
                  options={LEVEL_OPTIONS}
                  placeholder="Select a level"
                />
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
          Add language
        </Button>
      </form>
    </SectionCard>
  );
}
