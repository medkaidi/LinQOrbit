import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, updateProfileSchema } from "@/lib/validations/auth.schemas";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "ada@company.com",
      password: "secret-123",
      remember: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "   ", password: "secret", remember: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("Email is required");
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret", remember: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Enter a valid email address",
    );
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "ada@company.com", password: "", remember: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("Password is required");
  });
});

describe("signupSchema", () => {
  const validValues = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@company.com",
    password: "super-secret",
    confirmPassword: "super-secret",
    sex: "female",
    phone: "+1 555 000 0000",
    homeCountry: "GB",
    currentCity: "Paris",
    currentCountry: "FR",
    terms: true,
  };

  it("accepts a complete registration", () => {
    expect(signupSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = signupSchema.safeParse({ ...validValues, password: "short", confirmPassword: "short" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects mismatched passwords on the confirmation field", () => {
    const result = signupSchema.safeParse({ ...validValues, confirmPassword: "different-one" });

    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((issue) => issue.message === "Passwords do not match");
    expect(issue?.path).toEqual(["confirmPassword"]);
  });

  it("requires the terms to be accepted", () => {
    const result = signupSchema.safeParse({ ...validValues, terms: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "You must accept the terms to continue",
    );
  });

  it("requires the first and last name", () => {
    const missingFirst = signupSchema.safeParse({ ...validValues, firstName: "  " });
    expect(missingFirst.success).toBe(false);
    expect(missingFirst.error?.issues.map((issue) => issue.message)).toContain(
      "First name is required",
    );

    const missingLast = signupSchema.safeParse({ ...validValues, lastName: "  " });
    expect(missingLast.success).toBe(false);
    expect(missingLast.error?.issues.map((issue) => issue.message)).toContain(
      "Last name is required",
    );
  });

  it("requires a sex selection", () => {
    const result = signupSchema.safeParse({ ...validValues, sex: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("Please select an option");
  });

  it("rejects an invalid phone number", () => {
    const result = signupSchema.safeParse({ ...validValues, phone: "not-a-phone" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Enter a valid phone number",
    );
  });

  it("requires the current city and countries", () => {
    const missingCity = signupSchema.safeParse({ ...validValues, currentCity: "  " });
    expect(missingCity.success).toBe(false);
    expect(missingCity.error?.issues.map((issue) => issue.message)).toContain(
      "Current city is required",
    );

    const missingHome = signupSchema.safeParse({ ...validValues, homeCountry: "" });
    expect(missingHome.success).toBe(false);
    expect(missingHome.error?.issues.map((issue) => issue.message)).toContain(
      "Country of origin is required",
    );

    const missingCurrent = signupSchema.safeParse({ ...validValues, currentCountry: "" });
    expect(missingCurrent.success).toBe(false);
    expect(missingCurrent.error?.issues.map((issue) => issue.message)).toContain(
      "Current country is required",
    );
  });
});

describe("updateProfileSchema", () => {
  const validValues = {
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "+1 555 000 0000",
    currentCity: "Paris",
    currentCountry: "FR",
  };

  it("accepts a complete identity", () => {
    expect(updateProfileSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects an empty first name", () => {
    const result = updateProfileSchema.safeParse({ ...validValues, firstName: "  " });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "First name is required",
    );
  });

  it("rejects an invalid phone number", () => {
    const result = updateProfileSchema.safeParse({ ...validValues, phone: "not-a-phone" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Enter a valid phone number",
    );
  });

  it("rejects an empty city", () => {
    const result = updateProfileSchema.safeParse({ ...validValues, currentCity: "   " });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Current city is required",
    );
  });

  it("rejects a missing country", () => {
    const result = updateProfileSchema.safeParse({ ...validValues, currentCountry: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Current country is required",
    );
  });
});
