import { api } from "@/lib/api/axios";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { CompanyValues } from "@/lib/validations/recruiter.schemas";
import type { Company } from "@/types/recruiter";

export async function listCompanies(): Promise<Company[]> {
  const response = await api.get<Company[]>("/api/v1/companies");
  return response.data;
}

export async function getCompany(companyId: string): Promise<Company> {
  const response = await api.get<Company>(`/api/v1/companies/${companyId}`);
  return response.data;
}

export async function createCompany(values: CompanyValues): Promise<Company> {
  const response = await api.post<Company>("/api/v1/companies", {
    name: values.name,
    description: values.description === "" ? null : values.description,
  });
  return response.data;
}

export async function updateCompany(
  companyId: string,
  values: CompanyValues,
): Promise<void> {
  // Miroir backend : name null = inchangé (jamais envoyé, le formulaire
  // exige un nom), description "" = effacée (null laisserait inchangée).
  await api.put(`/api/v1/companies/${companyId}`, {
    name: values.name,
    description: values.description,
  });
}

export function getCompanyErrorMessage(error: unknown): string {
  return getApiErrorMessage(error);
}
