import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SignUpForm } from "@/features/auth/signup-form";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, signup: vi.fn(), login: vi.fn() };
});

import { signup as signupApi } from "@/lib/api/auth.api";
import type { AuthResponse } from "@/types/auth";

const mockedSignup = vi.mocked(signupApi);

const authResponse: AuthResponse = {
  token: "jwt-token",
  user: {
    id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    sex: "female",
    phone: "+1 555 000 0000",
    homeCountry: "FR",
    currentCity: "Paris",
    currentCountry: "FR",
    roles: [],
  },
};

function chooseOption(label: string, optionLabel: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@company.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "super-secret" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "super-secret" },
  });
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  chooseOption("Sex", "Female");
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+1 555 000 0000" } });
  chooseOption("Country of origin", "United Kingdom");
  fireEvent.change(screen.getByLabelText("Current city"), { target: { value: "Paris" } });
  chooseOption("Current country", "France");
  fireEvent.click(
    screen.getByRole("checkbox", { name: "I agree to the Terms of Service and Privacy Policy" }),
  );
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "Create your account" }));
}

describe("SignUpForm", () => {
  beforeEach(() => {
    mockedSignup.mockReset();
    pushMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("shows validation errors when submitted empty", async () => {
    renderWithQueryClient(<SignUpForm />);
    submitForm();

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(await screen.findByText("Please confirm your password")).toBeInTheDocument();
    expect(await screen.findByText("Please select an option")).toBeInTheDocument();
    expect(await screen.findByText("Phone number is required")).toBeInTheDocument();
    expect(await screen.findByText("You must accept the terms to continue")).toBeInTheDocument();
  });

  it("rejects mismatched passwords", async () => {
    renderWithQueryClient(<SignUpForm />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "another-secret" },
    });
    submitForm();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockedSignup).not.toHaveBeenCalled();
  });

  it("starts with the terms unchecked", () => {
    renderWithQueryClient(<SignUpForm />);

    expect(
      screen.getByRole("checkbox", { name: "I agree to the Terms of Service and Privacy Policy" }),
    ).not.toBeChecked();
  });

  it("submits the account and redirects on success", async () => {
    mockedSignup.mockResolvedValue(authResponse);
    renderWithQueryClient(<SignUpForm />);
    fillValidForm();
    submitForm();

    await waitFor(() =>
      expect(mockedSignup).toHaveBeenCalledWith({
        email: "ada@company.com",
        password: "super-secret",
        confirmPassword: "super-secret",
        firstName: "Ada",
        lastName: "Lovelace",
        sex: "female",
        phone: "+1 555 000 0000",
        homeCountry: "GB",
        currentCity: "Paris",
        currentCountry: "FR",
        terms: true,
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(useAuthStore.getState().token).toBe("jwt-token");
  });

  it("shows the server error when the email is already registered", async () => {
    mockedSignup.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: { data: { detail: "An account already exists for this email." } },
      }),
    );
    renderWithQueryClient(<SignUpForm />);
    fillValidForm();
    submitForm();

    expect(await screen.findByText("Sign-up failed")).toBeInTheDocument();
    expect(screen.getByText("An account already exists for this email.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables the submit button while the request is pending", async () => {
    mockedSignup.mockReturnValue(new Promise(() => {}));
    renderWithQueryClient(<SignUpForm />);
    fillValidForm();
    submitForm();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create your account" })).toBeDisabled(),
    );
  });
});
