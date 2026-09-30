import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthErrorMessage, login, signup } from "@/lib/api/auth.api";

vi.mock("@/lib/api/axios", () => ({
  api: { post: vi.fn() },
}));

import { api } from "@/lib/api/axios";

const mockedPost = vi.mocked(api.post);

const signupValues = {
  email: "ada@example.com",
  password: "super-secret",
  confirmPassword: "super-secret",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female" as const,
  phone: "+1 555 000 0000",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  terms: true,
};

const loginValues = {
  email: "ada@example.com",
  password: "super-secret",
  remember: true,
};

describe("auth.api", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("posts the signup payload without confirmPassword nor terms", async () => {
    const data = { token: "jwt", user: { id: "1" } };
    mockedPost.mockResolvedValue({ data });

    const result = await signup(signupValues);

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/auth/signup", {
      email: "ada@example.com",
      password: "super-secret",
      firstName: "Ada",
      lastName: "Lovelace",
      sex: "female",
      phone: "+1 555 000 0000",
      homeCountry: "FR",
      currentCity: "Paris",
      currentCountry: "FR",
    });
    expect(result).toEqual(data);
  });

  it("posts only email and password on login", async () => {
    const data = { token: "jwt", user: { id: "1" } };
    mockedPost.mockResolvedValue({ data });

    const result = await login(loginValues);

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/auth/login", {
      email: "ada@example.com",
      password: "super-secret",
    });
    expect(result).toEqual(data);
  });
});

describe("getAuthErrorMessage", () => {
  it("prefers the ProblemDetail detail", () => {
    const error = Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: { data: { detail: "An account already exists for this email.", title: "Email already registered" } },
    });

    expect(getAuthErrorMessage(error)).toBe("An account already exists for this email.");
  });

  it("falls back to the ProblemDetail title", () => {
    const error = Object.assign(new Error("unauthorized"), {
      isAxiosError: true,
      response: { data: { title: "Invalid credentials" } },
    });

    expect(getAuthErrorMessage(error)).toBe("Invalid credentials");
  });

  it("reports unreachable servers", () => {
    const error = Object.assign(new Error("Network Error"), { isAxiosError: true });

    expect(getAuthErrorMessage(error)).toBe("Cannot reach the server. Please try again.");
  });

  it("falls back to a generic message", () => {
    expect(getAuthErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});
