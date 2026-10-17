"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { useCompanies, useCreateCompany, useUpdateCompany } from "@/hooks/use-companies";
import { getCompanyErrorMessage } from "@/lib/api/company.api";
import {
  companySchema,
  type CompanyValues,
} from "@/lib/validations/recruiter.schemas";
import type { Company } from "@/types/recruiter";

function CompanyForm({
  company,
  onDone,
}: {
  company?: Company;
  onDone: () => void;
}) {
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const mutation = company ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      description: company?.description ?? "",
    },
  });

  useEffect(() => {
    reset({
      name: company?.name ?? "",
      description: company?.description ?? "",
    });
  }, [company, reset]);

  const onSubmit = (values: CompanyValues) => {
    if (company) {
      update.mutate({ companyId: company.id, values }, { onSuccess: onDone });
    } else {
      create.mutate(values, { onSuccess: onDone });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {mutation.isError ? (
        <Alert variant="error" title="Could not save the company">
          {getCompanyErrorMessage(mutation.error)}
        </Alert>
      ) : null}
      <TextField
        label="Company name"
        error={errors.name?.message}
        {...register("name")}
      />
      <Textarea
        label="Description"
        rows={3}
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <CtaButton type="submit" icon="save" busy={mutation.isPending} disabled={!isDirty}>
          {company ? "Save changes" : "Create company"}
        </CtaButton>
      </div>
    </form>
  );
}

function CompanyRow({ company }: { company: Company }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className={ITEM_CARD_CLASS}>
        <CompanyForm company={company} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`${ITEM_CARD_CLASS} flex flex-wrap items-start justify-between gap-4`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-md font-body-md text-text-primary font-semibold truncate">
            {company.name}
          </p>
          <Badge tone={company.isOwner ? "success" : "neutral"}>
            {company.isOwner ? "Owner" : "Member"}
          </Badge>
        </div>
        {company.description ? (
          <p className={MUTED_TEXT_CLASS}>{company.description}</p>
        ) : null}
      </div>
      {company.isOwner ? (
        <Button variant="outline-sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      ) : null}
    </li>
  );
}

/** Companies du recruteur (D11–D12) : liste, création inline, édition owner. */
export function CompaniesSection() {
  const companies = useCompanies();
  const [creating, setCreating] = useState(false);

  if (companies.isError) {
    return (
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Companies</h2>
        </header>
        <div className="px-6 pt-5 pb-6">
          <Alert variant="error" title="Could not load companies">
            <div className="flex items-center justify-between gap-3">
              <span>{getCompanyErrorMessage(companies.error)}</span>
              <Button variant="outline-sm" onClick={() => void companies.refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      </section>
    );
  }

  const list = companies.data ?? [];

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Companies</h2>
        <Button variant="outline-sm" onClick={() => setCreating((value) => !value)}>
          {creating ? "Close" : "Add company"}
        </Button>
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        {creating ? <CompanyForm onDone={() => setCreating(false)} /> : null}
        {list.length === 0 && !creating ? (
          <p className="text-body-md font-body-md text-text-secondary">
            No companies yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
