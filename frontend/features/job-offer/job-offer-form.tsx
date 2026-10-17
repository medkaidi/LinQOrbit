"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "@/components/ui/tag-input";
import { TextField } from "@/components/ui/text-field";
import type { SelectOption } from "@/components/ui/select";
import { countryOptions } from "@/config/countries";
import { SelectField } from "@/features/candidate/select-field";
import { RemoveButton } from "@/features/candidate/profile-shared";
import { OfferQuestionsSection } from "@/features/job-offer/offer-questions-section";
import {
  useReferenceDegrees,
  useReferenceLanguages,
  useReferenceSkills,
  useReferenceStudyFields,
} from "@/hooks/use-candidate-profile";
import {
  useContractTypes,
  useCreateJobOffer,
  useEmploymentTypes,
  useUpdateJobOffer,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";
import {
  createJobOfferSchema,
  JOB_OFFER_SALARY_PERIODS,
  REQUIREMENT_TYPES,
  type CreateJobOfferValues,
} from "@/lib/validations/job-offer.schemas";
import type { Company, JobOffer } from "@/types/recruiter";
import {
  OFFER_ITEM_CARD,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
} from "@/features/job-offer/job-offer-shared";

const SENIORITY_OPTIONS: SelectOption[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "principal", label: "Principal" },
];

const PERIOD_OPTIONS: SelectOption[] = JOB_OFFER_SALARY_PERIODS.map((value) => ({
  value,
  label: `Per ${value}`,
}));

const REQUIREMENT_OPTIONS: SelectOption[] = REQUIREMENT_TYPES.map((value) => ({
  value,
  label: value === "mandatory" ? "Mandatory" : "Preferred",
}));

const WEIGHT_OPTIONS: SelectOption[] = ["1", "2", "3", "4", "5"].map((value) => ({
  value,
  label: `${value}/5`,
}));

const CEFR_OPTIONS: SelectOption[] = ["A1", "A2", "B1", "B2", "C1", "C2"].map((value) => ({
  value,
  label: value,
}));

const emptySkill = () => ({
  skillId: "",
  requirementType: "mandatory" as const,
  weight: "3" as const,
  yearsExperience: "",
});

const emptyLanguage = () => ({
  languageId: "",
  level: "" as const,
  isRequired: false,
});

function toFormValues(offer: JobOffer, companyId: string): CreateJobOfferValues {
  return {
    companyId,
    title: offer.title,
    description: offer.description ?? "",
    seniority: offer.seniority ?? "",
    requiredExpYear: offer.requiredExpYear === null ? "" : String(offer.requiredExpYear),
    city: offer.city ?? "",
    country: offer.country ?? "",
    contractTypeId: offer.contractTypeId ?? "",
    employmentTypeId: offer.employmentTypeId ?? "",
    workModeId: offer.workModeId ?? "",
    expiresAt: offer.expiresAt ?? "",
    salaryMin: offer.salaryMin === null ? "" : String(offer.salaryMin),
    salaryMax: offer.salaryMax === null ? "" : String(offer.salaryMax),
    salaryCurrency: offer.salaryCurrency ?? "",
    salaryPeriod: offer.salaryPeriod ?? "",
    skills: offer.skills.map((skill) => ({
      skillId: skill.skillId,
      requirementType: skill.requirementType,
      weight: String(skill.weight) as CreateJobOfferValues["skills"][number]["weight"],
      yearsExperience:
        skill.yearsExperience === null ? "" : String(skill.yearsExperience),
    })),
    languages: offer.languages.map((language) => ({
      languageId: language.languageId,
      level: language.level as CreateJobOfferValues["languages"][number]["level"],
      isRequired: language.isRequired,
    })),
    degreeIds: offer.degreeIds,
    studyFieldIds: offer.studyFieldIds,
    questions: offer.questions.map((question) => ({
      label: question.label,
      type: question.type,
      isRequired: question.isRequired,
      options: question.options.map((option) => ({
        label: option.label,
        preferred: option.preferred,
      })),
    })),
  };
}

function emptyValues(companyId: string): CreateJobOfferValues {
  return {
    companyId,
    title: "",
    description: "",
    seniority: "",
    requiredExpYear: "",
    city: "",
    country: "",
    contractTypeId: "",
    employmentTypeId: "",
    workModeId: "",
    expiresAt: "",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "",
    salaryPeriod: "",
    skills: [],
    languages: [],
    degreeIds: [],
    studyFieldIds: [],
    questions: [],
  };
}

function RowCard({ children }: { children: React.ReactNode }) {
  return <li className={`${OFFER_ITEM_CARD} flex flex-wrap items-end gap-3`}>{children}</li>;
}

/**
 * Cellule d'action de ligne : même hauteur que l'input (`h-11`), centrée —
 * le `items-end` du RowCard aligne le bas du wrapper sur le bas de l'input,
 * donc le centre du bouton tombe exactement sur l'axe des champs.
 */
function RowAction({ children }: { children: React.ReactNode }) {
  return <div className="h-11 flex items-center shrink-0">{children}</div>;
}

/**
 * Formulaire création / édition d'offre (D12–D14) : un seul schéma pour les
 * deux modes, vocabulaires résolus depuis les endpoints de référence, listes
 * remplacées intégralement par le PUT (miroir backend).
 */
export function JobOfferForm({
  mode,
  offer,
  companies,
}: {
  mode: "create" | "edit";
  offer?: JobOffer;
  companies: Company[];
}) {
  const router = useRouter();
  const create = useCreateJobOffer();
  const update = useUpdateJobOffer();

  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();
  const workModes = useWorkModes();
  const skills = useReferenceSkills();
  const languages = useReferenceLanguages();
  const degrees = useReferenceDegrees();
  const studyFields = useReferenceStudyFields();

  const defaultCompanyId =
    mode === "edit" && offer ? offer.companyId : (companies[0]?.id ?? "");
  const mutation = mode === "edit" ? update : create;

  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isDirty },
  } = useForm<CreateJobOfferValues>({
    resolver: zodResolver(createJobOfferSchema),
    defaultValues:
      mode === "edit" && offer
        ? toFormValues(offer, defaultCompanyId)
        : emptyValues(defaultCompanyId),
  });

  const skillRows = useFieldArray({ control, name: "skills" });
  const languageRows = useFieldArray({ control, name: "languages" });

  const skillOptions = (skills.data ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const languageOptions = (languages.data ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const degreeOptions = (degrees.data ?? []).map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const studyFieldOptions = (studyFields.data ?? []).map((option) => ({
    value: option.id,
    label: option.label,
  }));

  const labelOptions = (options: { id: string; label: string }[]): SelectOption[] =>
    options.map((option) => ({ value: option.id, label: option.label }));

  const onSubmit = (values: CreateJobOfferValues) => {
    const done = () => router.push("/recruiter");
    if (mode === "edit" && offer) {
      update.mutate({ offerId: offer.id, values }, { onSuccess: done });
    } else {
      create.mutate(values, { onSuccess: done });
    }
  };

  const error = mutation.error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      {error ? (
        <Alert variant="error" title="Could not save the offer">
          {getJobOfferErrorMessage(error)}
        </Alert>
      ) : null}

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Basics</h2>
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
          {mode === "create" && companies.length > 1 ? (
            <SelectField
              control={control}
              name="companyId"
              label="Company"
              options={companies.map((company) => ({
                value: company.id,
                label: company.name,
              }))}
              placeholder="Pick a company"
            />
          ) : null}
          <TextField
            label="Title"
            placeholder="Backend Engineer"
            error={errors.title?.message}
            {...register("title")}
          />
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <RichTextEditor
                label="Description"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="What will this person build?"
              />
            )}
          />
        </div>
      </section>

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Role &amp; location</h2>
        </header>
        <div className="px-6 pt-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            control={control}
            name="seniority"
            label="Seniority"
            options={SENIORITY_OPTIONS}
            placeholder="Not specified"
          />
          <TextField
            label="Years of experience"
            inputMode="numeric"
            placeholder="3"
            error={errors.requiredExpYear?.message}
            {...register("requiredExpYear")}
          />
          <TextField
            label="City"
            placeholder="Paris"
            error={errors.city?.message}
            {...register("city")}
          />
          <SelectField
            control={control}
            name="country"
            label="Country"
            options={countryOptions}
            placeholder="Not specified"
            searchable
          />
        </div>
      </section>

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Contract &amp; salary</h2>
        </header>
        <div className="px-6 pt-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            control={control}
            name="contractTypeId"
            label="Contract type"
            options={labelOptions(contractTypes.data ?? [])}
            placeholder="Not specified"
          />
          <SelectField
            control={control}
            name="employmentTypeId"
            label="Employment type"
            options={labelOptions(employmentTypes.data ?? [])}
            placeholder="Not specified"
          />
          <SelectField
            control={control}
            name="workModeId"
            label="Work mode"
            options={labelOptions(workModes.data ?? [])}
            placeholder="Not specified"
          />
          <TextField
            type="date"
            label="Expires on"
            error={errors.expiresAt?.message}
            {...register("expiresAt")}
          />
          <TextField
            label="Salary minimum"
            inputMode="decimal"
            placeholder="50000"
            error={errors.salaryMin?.message}
            {...register("salaryMin")}
          />
          <TextField
            label="Salary maximum"
            inputMode="decimal"
            placeholder="70000"
            error={errors.salaryMax?.message}
            {...register("salaryMax")}
          />
          <TextField
            label="Currency"
            placeholder="EUR"
            error={errors.salaryCurrency?.message}
            {...register("salaryCurrency")}
          />
          <SelectField
            control={control}
            name="salaryPeriod"
            label="Salary period"
            options={PERIOD_OPTIONS}
            placeholder="Not specified"
          />
        </div>
      </section>

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Skills</h2>
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
          {skillRows.fields.length === 0 ? (
            <p className="text-body-sm font-body-sm text-text-secondary">
              No skills yet. Add the required and nice-to-have skills for this role.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 w-full">
              {skillRows.fields.map((row, index) => (
                <RowCard key={row.id}>
                  <div className="min-w-52 flex-1">
                    <SelectField
                      control={control}
                      name={`skills.${index}.skillId`}
                      label="Skill"
                      options={skillOptions}
                      placeholder="Pick a skill"
                      searchable
                    />
                  </div>
                  <div className="w-40">
                    <SelectField
                      control={control}
                      name={`skills.${index}.requirementType`}
                      label="Requirement"
                      options={REQUIREMENT_OPTIONS}
                    />
                  </div>
                  <div className="w-24">
                    <SelectField
                      control={control}
                      name={`skills.${index}.weight`}
                      label="Weight"
                      options={WEIGHT_OPTIONS}
                    />
                  </div>
                  <div className="w-36">
                    <TextField
                      label="Years"
                      inputMode="numeric"
                      placeholder="—"
                      error={errors.skills?.[index]?.yearsExperience?.message}
                      {...register(`skills.${index}.yearsExperience`)}
                    />
                  </div>
                  <RowAction>
                    <RemoveButton onClick={() => skillRows.remove(index)} />
                  </RowAction>
                </RowCard>
              ))}
            </ul>
          )}
          {errors.skills !== undefined && !Array.isArray(errors.skills) ? (
            <p className="text-body-sm font-body-sm text-danger">{errors.skills.message}</p>
          ) : null}
          <CtaButton
            type="button"
            tone="secondary"
            icon="add"
            onClick={() => skillRows.append(emptySkill())}
          >
            Add skill
          </CtaButton>
        </div>
      </section>

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Languages</h2>
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
          {languageRows.fields.length === 0 ? (
            <p className="text-body-sm font-body-sm text-text-secondary">
              No languages required.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 w-full">
              {languageRows.fields.map((row, index) => (
                <RowCard key={row.id}>
                  <div className="min-w-52 flex-1">
                    <SelectField
                      control={control}
                      name={`languages.${index}.languageId`}
                      label="Language"
                      options={languageOptions}
                      placeholder="Pick a language"
                      searchable
                    />
                  </div>
                  <div className="w-40">
                    <SelectField
                      control={control}
                      name={`languages.${index}.level`}
                      label="Level"
                      options={CEFR_OPTIONS}
                      placeholder="Pick a level"
                    />
                  </div>
                  <RowAction>
                    <Controller
                      control={control}
                      name={`languages.${index}.isRequired`}
                      render={({ field }) => (
                        <Checkbox
                          label="Required"
                          checked={field.value === true}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </RowAction>
                  <RowAction>
                    <RemoveButton onClick={() => languageRows.remove(index)} />
                  </RowAction>
                </RowCard>
              ))}
            </ul>
          )}
          <CtaButton
            type="button"
            tone="secondary"
            icon="add"
            onClick={() => languageRows.append(emptyLanguage())}
          >
            Add language
          </CtaButton>
        </div>
      </section>

      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Education</h2>
        </header>
        <div className="px-6 pt-5 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            control={control}
            name="degreeIds"
            render={({ field, fieldState }) => (
              <TagInput
                label="Degrees"
                options={degreeOptions}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="Type to search degrees…"
              />
            )}
          />
          <Controller
            control={control}
            name="studyFieldIds"
            render={({ field, fieldState }) => (
              <TagInput
                label="Fields of study"
                options={studyFieldOptions}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="Type to search fields…"
              />
            )}
          />
        </div>
      </section>

      <OfferQuestionsSection control={control} errors={errors} />

      <div className="bg-canvas-white rounded-2xl shadow-sm px-6 py-4 flex items-center justify-end gap-3">
        <Button type="button" variant="outline-sm" onClick={() => router.push("/recruiter")}>
          Cancel
        </Button>
        <CtaButton type="submit" icon="save" busy={mutation.isPending} disabled={!isDirty}>
          {mode === "edit" ? "Save changes" : "Create offer"}
        </CtaButton>
      </div>
    </form>
  );
}
