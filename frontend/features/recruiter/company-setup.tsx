"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { SECTION_HEADER_CLASS, SECTION_TITLE_CLASS } from "@/components/ui/section";
import { useCreateCompany } from "@/hooks/use-companies";
import { getCompanyErrorMessage } from "@/lib/api/company.api";
import {
  companySchema,
  type CompanyValues,
} from "@/lib/validations/recruiter.schemas";

/**
 * Création de la première company (D11) : le recruteur créateur en devient
 * l'owner — état « pas encore de company » de l'espace recruteur (D16).
 */
export function CompanySetup() {
  const create = useCreateCompany();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", description: "" },
  });

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Set up your company</h2>
      </header>
      <form
        onSubmit={handleSubmit((values) => create.mutate(values))}
        className="px-6 pt-5 pb-6 flex flex-col gap-4"
        noValidate
      >
        <p className="text-body-md font-body-md text-text-secondary">
          Your company hosts the job offers you publish. You can add more
          companies later from settings.
        </p>
        {create.isError ? (
          <Alert variant="error" title="Could not create the company">
            {getCompanyErrorMessage(create.error)}
          </Alert>
        ) : null}
        <TextField
          label="Company name"
          placeholder="Nimbus Labs"
          error={errors.name?.message}
          {...register("name")}
        />
        <Textarea
          label="Description"
          rows={4}
          placeholder="What does your company build?"
          error={errors.description?.message}
          {...register("description")}
        />
        <CtaButton
          type="submit"
          icon="domain"
          busy={create.isPending}
          disabled={!isDirty}
          className="self-start"
        >
          Create company
        </CtaButton>
      </form>
    </section>
  );
}
