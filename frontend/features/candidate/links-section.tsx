"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/features/candidate/section-card";
import { SECTION_ICONS } from "@/features/candidate/profile-shared";
import { applyCvToLinks, planCvImport } from "@/features/candidate/cv-parsing";
import { useApplyCvImport } from "@/hooks/use-apply-cv-import";
import { useUpdateLinks } from "@/hooks/use-candidate-profile";
import type { LinkItem, ParsedCv } from "@/types/candidate";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import {
  LINK_TYPES,
  linksSchema,
  type LinkValues,
  type LinksValues,
} from "@/lib/validations/candidate.schemas";

export const LINK_TYPE_LABELS: Record<(typeof LINK_TYPES)[number], string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  gitlab: "GitLab",
  stack_overflow: "Stack Overflow",
  website: "Website",
  x: "X (Twitter)",
  youtube: "YouTube",
  dribbble: "Dribbble",
  behance: "Behance",
  certification: "Certification",
  other: "Other",
};

const LINK_TYPE_OPTIONS: SelectOption[] = LINK_TYPES.map((value) => ({
  value,
  label: LINK_TYPE_LABELS[value],
}));

const emptyRow = (): LinkValues => ({
  label: "",
  url: "",
  linkType: "other",
  issuer: "",
  issuedAt: "",
});

const toFormItems = (items: LinkItem[]): LinkValues[] =>
  items.map((item) => ({
    label: item.label,
    url: item.url,
    linkType: item.linkType as LinkValues["linkType"],
    issuer: item.issuer ?? "",
    issuedAt: item.issuedAt ?? "",
  }));

export function LinksSection({
  links,
  cvImport,
}: {
  links: LinkItem[];
  cvImport?: ParsedCv | null;
}) {
  const mutation = useUpdateLinks();
  const [saved, setSaved] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<LinksValues>({
    resolver: zodResolver(linksSchema),
    defaultValues: { items: toFormItems(links) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const rows = useWatch({ control, name: "items" }) ?? [];

  useApplyCvImport(cvImport, (imported) => {
    const plan = planCvImport(imported);
    reset({ items: applyCvToLinks(toFormItems(links), plan) }, { keepDefaultValues: true });
    setSaved(false);
  });

  const onSubmit = (values: LinksValues) => {
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
    reset({ items: toFormItems(links) });
  };

  return (
    <SectionCard
      id="links"
      title="Links & certifications"
      icon={SECTION_ICONS.links}
      isComplete={links.length > 0}
      isDirty={isDirty}
      isSaving={mutation.isPending}
      errorMessage={mutation.isError ? getApiErrorMessage(mutation.error) : null}
      successMessage={saved && !isDirty ? "Your links are live on your profile." : null}
      onSave={handleSubmit(onSubmit)}
      onDiscard={onDiscard}
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {fields.length === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No link added yet. GitHub, LinkedIn and certifications are the usual starting point.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {fields.map((field, index) => {
            const isCertification = rows[index]?.linkType === "certification";

            return (
              <div
                key={field.id}
                className="rounded-2xl border border-slate-border bg-item-surface/50 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                    Link {index + 1}
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
                    label="Label"
                    placeholder="Personal portfolio"
                    error={errors.items?.[index]?.label?.message}
                    {...register(`items.${index}.label`)}
                  />
                  <TextField
                    label="URL"
                    placeholder="https://github.com/you"
                    inputMode="url"
                    error={errors.items?.[index]?.url?.message}
                    {...register(`items.${index}.url`)}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.linkType`}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Type"
                        options={LINK_TYPE_OPTIONS}
                        value={field.value}
                        error={fieldState.error?.message}
                        onBlur={field.onBlur}
                        onValueChange={(next) => {
                          field.onChange(next);
                          if (next !== "certification") {
                            setValue(`items.${index}.issuer`, "");
                            setValue(`items.${index}.issuedAt`, "");
                          }
                        }}
                      />
                    )}
                  />

                  {isCertification ? (
                    <>
                      <TextField
                        label="Issuer"
                        placeholder="AWS"
                        error={errors.items?.[index]?.issuer?.message}
                        {...register(`items.${index}.issuer`)}
                      />
                      <TextField
                        label="Issued on"
                        type="date"
                        error={errors.items?.[index]?.issuedAt?.message}
                        {...register(`items.${index}.issuedAt`)}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={() => append(emptyRow())}
        >
          Add link
        </Button>
      </form>
    </SectionCard>
  );
}
