"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCompany, listCompanies, updateCompany } from "@/lib/api/company.api";
import type { CompanyValues } from "@/lib/validations/recruiter.schemas";
import { queryKeys } from "@/hooks/query-keys";

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.recruiter.companies,
    queryFn: listCompanies,
    staleTime: 30_000,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CompanyValues) => createCompany(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruiter.companies });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, values }: { companyId: string; values: CompanyValues }) =>
      updateCompany(companyId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruiter.companies });
    },
  });
}
