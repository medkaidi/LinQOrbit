import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "Work email is required")
  .pipe(z.email("Enter a valid email address"));

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  workEmail: emailField,
  company: z.string().trim().min(1, "Company name is required"),
  teamSize: z.enum(["1-20", "21-100", "101-500", "500+"], "Please select a team size"),
  interests: z.array(
    z.enum([
      "enterprise-demo",
      "autonomous-sourcing",
      "ats-integration",
      "candidate-partnership",
      "other",
    ]),
  ),
  message: z.string().optional(),
  consent: z
    .boolean()
    .refine((accepted) => accepted, "You must accept the privacy policy to continue"),
});

export type ContactValues = z.infer<typeof contactSchema>;
