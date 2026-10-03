"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { ReferenceError } from "@/features/candidate/reference-error";
import { SectionCard } from "@/features/candidate/section-card";
import { SECTION_DESCRIPTIONS } from "@/features/candidate/profile-shared";
import { SelectField } from "@/features/candidate/select-field";
import { useReferenceSkills, useUpdateSkills } from "@/hooks/use-candidate-profile";
import type { SkillItem } from "@/lib/api/candidate.api";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { SelectOption } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { skillsSchema, type SkillValues, type SkillsValues } from "@/lib/validations/candidate.schemas";

const LEVEL_OPTIONS: SelectOption[] = [
  { value: "1", label: "1 · Beginner" },
  { value: "2", label: "2 · Elementary" },
  { value: "3", label: "3 · Intermediate" },
  { value: "4", label: "4 · Advanced" },
  { value: "5", label: "5 · Expert" },
];

const emptyRow = (): SkillValues => ({
  skillId: "",
  // NaN = pas encore choisi : le select affiche son placeholder.
  level: Number.NaN,
  yearsExperience: "",
});

const toFormItems = (items: SkillItem[]): SkillValues[] =>
  items.map((item) => ({
    skillId: item.skillId,
    level: item.level,
    yearsExperience: item.yearsExperience == null ? "" : String(item.yearsExperience),
  }));

export function SkillsSection({ skills }: { skills: SkillItem[] }) {
  const mutation = useUpdateSkills();
  const reference = useReferenceSkills();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SkillsValues>({
    resolver: zodResolver(skillsSchema),
    defaultValues: { items: toFormItems(skills) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const rows = useWatch({ control, name: "items" }) ?? [];

  const onSubmit = (values: SkillsValues) => {
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
    reset({ items: toFormItems(skills) });
  };

  const referenceOptions = (reference.data ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));

  /** Une compétence déjà posée ailleurs dans la liste ne se propose plus. */
  const optionsFor = (index: number): SelectOption[] => {
    const current = rows[index]?.skillId;
    const used = new Set(rows.filter((_, position) => position !== index).map((row) => row.skillId));
    return referenceOptions.filter((option) => option.value === current || !used.has(option.value));
  };

  return (
    <SectionCard
      id="skills"
      title="Skills"
      description={SECTION_DESCRIPTIONS.skills}
      isComplete={skills.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your skills are live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {reference.isError ? (
          <ReferenceError what="Skills" onRetry={() => void reference.refetch()} />
        ) : null}

        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No skill added yet. Start with what you use every day.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-slate-border bg-canvas-subtle p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Skill {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="font-body-sm text-body-sm text-error hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SelectField
                  control={control}
                  name={`items.${index}.skillId`}
                  label="Skill"
                  options={optionsFor(index)}
                  placeholder="Select a skill"
                  disabled={reference.isLoading}
                  searchable
                />
                <SelectField
                  control={control}
                  name={`items.${index}.level`}
                  label="Level"
                  options={LEVEL_OPTIONS}
                  placeholder="Select a level"
                  parse={(value) => Number(value)}
                />
                <TextField
                  label="Years"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Optional"
                  error={errors.items?.[index]?.yearsExperience?.message}
                  {...register(`items.${index}.yearsExperience`)}
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
          Add skill
        </Button>
      </form>
    </SectionCard>
  );
}
