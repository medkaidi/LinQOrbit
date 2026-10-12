import { api } from "@/lib/api/axios";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { UpdateRecruiterValues } from "@/lib/validations/recruiter.schemas";
import type { RecruiterProfile } from "@/types/recruiter";

export async function getRecruiter(): Promise<RecruiterProfile> {
  const response = await api.get<RecruiterProfile>("/api/v1/recruiters/me");
  return response.data;
}

export async function createRecruiter(): Promise<RecruiterProfile> {
  const response = await api.post<RecruiterProfile>("/api/v1/recruiters/me");
  return response.data;
}

/** "" = effacé (miroir backend : null laisserait inchangé). */
export async function updateRecruiter(values: UpdateRecruiterValues): Promise<void> {
  await api.put("/api/v1/recruiters/me", {
    headline: values.headline,
    bio: values.bio,
  });
}

export function getRecruiterErrorMessage(error: unknown): string {
  return getApiErrorMessage(error);
}
