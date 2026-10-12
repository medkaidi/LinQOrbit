import { z } from "zod";

/**
 * Profil recruteur (D10) : headline et bio optionnels, "" = effacer.
 * Company (D11) : nom requis, description optionnelle.
 */
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

export const updateRecruiterSchema = z.object({
  headline: optionalText(100, "Headline"),
  bio: optionalText(2000, "Bio"),
});

export type UpdateRecruiterValues = z.infer<typeof updateRecruiterSchema>;

export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(255, "Company name must be 255 characters or fewer"),
  description: optionalText(2000, "Description"),
});

export type CompanyValues = z.infer<typeof companySchema>;
