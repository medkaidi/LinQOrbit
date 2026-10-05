import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/features/auth/login-form";
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

import { login as loginApi } from "@/lib/api/auth.api";
import type { AuthResponse } from "@/types/auth";

const mockedLogin = vi.mocked(loginApi);

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
  },
};

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "Sign in to your workspace" }));
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@company.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-123" } });
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    pushMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("shows validation errors when submitted empty", async () => {
    renderWithQueryClient(<LoginForm />);
    submitForm();

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rejects a malformed email", async () => {
    renderWithQueryClient(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-123" } });
    submitForm();

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
  });

  it("toggles the password visibility", () => {
    renderWithQueryClient(<LoginForm />);
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;

    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("starts with the remember me option checked", () => {
    renderWithQueryClient(<LoginForm />);

    expect(
      screen.getByRole("checkbox", { name: "Remember me for 30 days" }),
    ).toBeChecked();
  });

  it("submits the credentials and redirects on success", async () => {
    mockedLogin.mockResolvedValue(authResponse);
    renderWithQueryClient(<LoginForm />);
    fillValidForm();
    submitForm();

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith({
        email: "ada@company.com",
        password: "secret-123",
        remember: true,
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    expect(useAuthStore.getState().token).toBe("jwt-token");
  });

  it("shows the server error when the credentials are rejected", async () => {
    mockedLogin.mockRejectedValue(
      Object.assign(new Error("unauthorized"), {
        isAxiosError: true,
        response: { data: { detail: "The email or password is incorrect." } },
      }),
    );
    renderWithQueryClient(<LoginForm />);
    fillValidForm();
    submitForm();

    expect(await screen.findByText("Sign-in failed")).toBeInTheDocument();
    expect(screen.getByText("The email or password is incorrect.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables the submit button while the request is pending", async () => {
    mockedLogin.mockReturnValue(new Promise(() => {}));
    renderWithQueryClient(<LoginForm />);
    fillValidForm();
    submitForm();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in to your workspace" })).toBeDisabled(),
    );
  });
});
