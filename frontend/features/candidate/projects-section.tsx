"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { SectionCard } from "@/features/candidate/section-card";
import { RemoveButton, SECTION_ICONS } from "@/features/candidate/profile-shared";
import { useUpdateProjects } from "@/hooks/use-candidate-profile";
import type { ProjectItem } from "@/types/candidate";
import { CtaButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  projectsSchema,
  type ProjectValues,
  type ProjectsValues,
} from "@/lib/validations/candidate.schemas";

const emptyRow = (): ProjectValues => ({
  name: "",
  role: "",
  startDate: "",
  endDate: "",
  description: "",
  technologies: "",
});

const toFormItems = (items: ProjectItem[]): ProjectValues[] =>
  items.map((item) => ({
    name: item.name,
    role: item.role ?? "",
    startDate: item.startDate,
    endDate: item.endDate ?? "",
    description: item.description ?? "",
    technologies: item.technologies ?? "",
  }));

export function ProjectsSection({ projects }: { projects: ProjectItem[] }) {
  const mutation = useUpdateProjects();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProjectsValues>({
    resolver: zodResolver(projectsSchema),
    defaultValues: { items: toFormItems(projects) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit = (values: ProjectsValues) => {
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
    reset({ items: toFormItems(projects) });
  };

  return (
    <SectionCard
      id="projects"
      title="Projects"
      icon={SECTION_ICONS.projects}
      isComplete={projects.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your projects list is live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No project added yet. Side projects, open-source work and academic builds all count.
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
                  Project {index + 1}
                </span>
                <RemoveButton onClick={() => remove(index)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  label="Project name"
                  placeholder="Portfolio"
                  error={errors.items?.[index]?.name?.message}
                  {...register(`items.${index}.name`)}
                />
                <TextField
                  label="Role"
                  placeholder="Author"
                  error={errors.items?.[index]?.role?.message}
                  {...register(`items.${index}.role`)}
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
                <TextField
                  label="Technologies"
                  placeholder="Next.js, TypeScript"
                  error={errors.items?.[index]?.technologies?.message}
                  {...register(`items.${index}.technologies`)}
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Description"
                    placeholder="What you built, why it matters, what you learned."
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
          Add project
        </CtaButton>
      </form>
    </SectionCard>
  );
}
