import { z } from "zod";

import { CEFR_LEVELS } from "@/lib/validations/candidate.schemas";

export const JOB_OFFER_SENIORITIES = [
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
] as const;
export const JOB_OFFER_SALARY_PERIODS = ["year", "month", "day", "hour"] as const;
export const REQUIREMENT_TYPES = ["mandatory", "preferred"] as const;

/**
 * Formulaire d'offre : tous les champs facultatifs restent des `string`
 * ("" = vide, conversion en null/nombre dans la couche API — règle
 * z.input ≠ z.output interdite sur un resolver).
 */
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const uuidOrEmpty = (label: string) =>
  z.union([z.uuid(label), z.literal("")], label);

const twoLetterOrEmpty = z.union(
  [z.string().regex(/^[A-Z]{2}$/, "Country must be a 2-letter ISO code"), z.literal("")],
  "Country must be a 2-letter ISO code",
);

const amountOrEmpty = z.union(
  [z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a valid amount"), z.literal("")],
  "Enter a valid amount",
);

const currencyOrEmpty = z.union(
  [
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code"),
    z.literal(""),
  ],
  "Currency must be a 3-letter ISO code",
);

const yearsOrEmpty = z.union(
  [z.string().regex(/^([0-9]|[1-5][0-9]|60)$/, "Enter a number between 0 and 60"), z.literal("")],
  "Enter a number between 0 and 60",
);

const weightString = z.enum(
  ["1", "2", "3", "4", "5"],
  "Weight must be between 1 and 5",
);

const cefrOrEmpty = z.union(
  [z.enum(CEFR_LEVELS), z.literal("")],
  "Pick a CEFR level",
);

export const jobOfferSkillRowSchema = z.object({
  skillId: uuidOrEmpty("Pick a skill"),
  requirementType: z.enum(REQUIREMENT_TYPES),
  weight: weightString,
  yearsExperience: yearsOrEmpty,
});

export const jobOfferLanguageRowSchema = z.object({
  languageId: uuidOrEmpty("Pick a language"),
  level: cefrOrEmpty,
  isRequired: z.boolean(),
});

const jobOfferBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(255, "Title must be 255 characters or fewer"),
  description: optionalText(20000, "Description"),
  seniority: z.union([z.enum(JOB_OFFER_SENIORITIES), z.literal("")], "Pick a seniority"),
  requiredExpYear: yearsOrEmpty,
  city: optionalText(255, "City"),
  country: twoLetterOrEmpty,
  contractTypeId: uuidOrEmpty("Pick a contract type"),
  employmentTypeId: uuidOrEmpty("Pick an employment type"),
  workModeId: uuidOrEmpty("Pick a work mode"),
  expiresAt: z.union([z.iso.date("Enter a valid date"), z.literal("")], "Enter a valid date"),
  salaryMin: amountOrEmpty,
  salaryMax: amountOrEmpty,
  salaryCurrency: currencyOrEmpty,
  salaryPeriod: z.union(
    [z.enum(JOB_OFFER_SALARY_PERIODS), z.literal("")],
    "Pick a salary period",
  ),
  skills: z.array(jobOfferSkillRowSchema),
  languages: z.array(jobOfferLanguageRowSchema),
  // Chips (TagInput) : jamais de "" en entrée — uuid strict.
  degreeIds: z.array(z.uuid("Pick a degree")),
  studyFieldIds: z.array(z.uuid("Pick a field of study")),
});

type JobOfferBaseValues = z.infer<typeof jobOfferBaseSchema>;

function refineJobOffer(values: JobOfferBaseValues, ctx: z.RefinementCtx) {
  if (
    values.salaryMin !== "" &&
    values.salaryMax !== "" &&
    Number(values.salaryMin) > Number(values.salaryMax)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["salaryMax"],
      message: "Maximum must be greater than or equal to minimum",
    });
  }
  values.languages.forEach((row, index) => {
    if (row.languageId !== "" && row.level === "") {
      ctx.addIssue({
        code: "custom",
        path: ["languages", index, "level"],
        message: "Pick a level",
      });
    }
  });
  // Miroir withUniqueReferences (profil candidat) : un doublon de référence
  // partirait tel quel dans le payload qui remplace les listes en base.
  const seenSkills = new Set<string>();
  values.skills.forEach((row, index) => {
    if (row.skillId === "") return;
    if (seenSkills.has(row.skillId)) {
      ctx.addIssue({
        code: "custom",
        path: ["skills", index, "skillId"],
        message: "This skill is already in your list",
      });
    }
    seenSkills.add(row.skillId);
  });
  const seenLanguages = new Set<string>();
  values.languages.forEach((row, index) => {
    if (row.languageId === "") return;
    if (seenLanguages.has(row.languageId)) {
      ctx.addIssue({
        code: "custom",
        path: ["languages", index, "languageId"],
        message: "This language is already in your list",
      });
    }
    seenLanguages.add(row.languageId);
  });
}

export const createJobOfferSchema = jobOfferBaseSchema
  .extend({ companyId: z.uuid("Pick a company") })
  .superRefine(refineJobOffer);

export type CreateJobOfferValues = z.infer<typeof createJobOfferSchema>;

export const updateJobOfferSchema = jobOfferBaseSchema
  .extend({ companyId: z.uuid("Pick a company") })
  .superRefine(refineJobOffer);

export type UpdateJobOfferValues = z.infer<typeof updateJobOfferSchema>;

/** Valeurs d'un formulaire d'offre (hors companyId, porté par la route/create). */
export type JobOfferValues = Omit<UpdateJobOfferValues, "companyId">;
