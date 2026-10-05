import { z } from "zod";

import { updateProfileSchema } from "@/lib/validations/auth.schemas";

export const SEARCH_STATUSES = ["open_to_work", "selective", "not_looking"] as const;
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const LINK_TYPES = [
  "linkedin",
  "github",
  "gitlab",
  "stack_overflow",
  "website",
  "x",
  "youtube",
  "dribbble",
  "behance",
  "certification",
  "other",
] as const;

/**
 * Les champs facultatifs acceptent "" plutôt que undefined : la valeur vide est
 * lue par le formulaire, puis convertie en null par la couche API.
 */
const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const country = z.string().max(2, "Country must be 2 characters or fewer");

const dateOrEmpty = z.union(
  [z.iso.date("Enter a valid date"), z.literal("")],
  "Enter a valid date",
);

const uuidOrEmpty = (label: string) => z.union([z.uuid(label), z.literal("")], label);

const yearsOrEmpty = z.string().regex(/^\d{0,2}$/, "Enter a number between 0 and 99");

const dateOrderCheck = <T extends { startDate?: string; endDate?: string }>(
  row: T,
  ctx: z.RefinementCtx,
) => {
  if (row.endDate && row.startDate && row.endDate < row.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be on or after the start date",
    });
  }
};

export const aboutSchema = z.object({
  title: text(255, "Current position"),
  bio: z.string().trim().max(2000, "Bio must be 2000 characters or fewer"),
  yearsOfExperience: z
    .number("Years of experience is required")
    .int("Years of experience must be a whole number")
    .min(0, "Years of experience must be 0 or more")
    .max(60, "Years of experience must be 60 or fewer"),
  searchStatus: z.enum(SEARCH_STATUSES, "Please select a search status"),
});

/**
 * Section About fusionnée : champs About + champs du compte (PUT /auth/me)
 * dans un seul Save. Le chemin dégradé (compte inconnu) utilise `aboutSchema`.
 */
export const aboutSectionSchema = aboutSchema.extend(updateProfileSchema.shape);

export const experienceSchema = z
  .object({
    positionTitle: text(255, "Position title"),
    companyName: text(255, "Company"),
    companyCountry: country,
    startDate: z.iso.date("Start date is required"),
    endDate: dateOrEmpty,
    description: optionalText(2000, "Description"),
  })
  .superRefine(dateOrderCheck);

export const diplomaSchema = z
  .object({
    title: text(255, "Degree title"),
    institution: text(255, "Institution"),
    institutionCountry: country,
    degreeId: uuidOrEmpty("Select a degree level"),
    studyFieldId: uuidOrEmpty("Select a field of study"),
    startDate: z.iso.date("Start date is required"),
    endDate: dateOrEmpty,
  })
  .superRefine(dateOrderCheck);

export const skillSchema = z.object({
  skillId: z.uuid("Select a skill"),
  level: z
    .number("Select a level")
    .int()
    .min(1, "Level must be between 1 and 5")
    .max(5, "Level must be between 1 and 5"),
  yearsExperience: yearsOrEmpty,
});

export const languageSchema = z.object({
  languageId: z.uuid("Select a language"),
  level: z.enum(CEFR_LEVELS, "Select a level"),
});

export const linkSchema = z.object({
  label: text(255, "Label"),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(500, "URL must be 500 characters or fewer")
    .regex(/^https?:\/\/\S+$/, "Enter a valid http(s) URL"),
  linkType: z.enum(LINK_TYPES, "Please select a type"),
  issuer: optionalText(255, "Issuer"),
  issuedAt: dateOrEmpty,
});

const withUniqueReferences = <T extends Record<string, unknown>>(
  items: T[],
  key: string,
  label: string,
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const id = item[key];
    if (typeof id !== "string" || !id) {
      return;
    }
    if (seen.has(id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, key],
        message: `This ${label} is already in your list`,
      });
    }
    seen.add(id);
  });
};

export const experiencesSchema = z.object({
  items: z.array(experienceSchema),
});

export const diplomasSchema = z.object({
  items: z.array(diplomaSchema),
});

export const skillsSchema = z.object({
  items: z.array(skillSchema).superRefine((items, ctx) =>
    withUniqueReferences(items, "skillId", "skill", ctx),
  ),
});

export const languagesSchema = z.object({
  items: z.array(languageSchema).superRefine((items, ctx) =>
    withUniqueReferences(items, "languageId", "language", ctx),
  ),
});

export const linksSchema = z.object({
  items: z.array(linkSchema),
});

export type AboutValues = z.infer<typeof aboutSchema>;
export type AboutSectionValues = z.infer<typeof aboutSectionSchema>;
export type ExperienceValues = z.infer<typeof experienceSchema>;
export type DiplomaValues = z.infer<typeof diplomaSchema>;
export type SkillValues = z.infer<typeof skillSchema>;
export type LanguageValues = z.infer<typeof languageSchema>;
export type LinkValues = z.infer<typeof linkSchema>;

export type ExperiencesValues = z.infer<typeof experiencesSchema>;
export type DiplomasValues = z.infer<typeof diplomasSchema>;
export type SkillsValues = z.infer<typeof skillsSchema>;
export type LanguagesValues = z.infer<typeof languagesSchema>;
export type LinksValues = z.infer<typeof linksSchema>;
