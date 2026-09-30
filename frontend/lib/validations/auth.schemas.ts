import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: emailField,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    sex: z.enum(["male", "female", "other"], "Please select an option"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .regex(/^[+()\-.\s\d]{6,20}$/, "Enter a valid phone number"),
    homeCountry: z.string().min(1, "Country of origin is required"),
    currentCity: z.string().trim().min(1, "Current city is required"),
    currentCountry: z.string().min(1, "Current country is required"),
    terms: z.boolean().refine((accepted) => accepted, "You must accept the terms to continue"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
