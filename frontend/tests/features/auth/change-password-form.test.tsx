import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChangePasswordForm } from "@/features/auth/change-password-form";

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, changePassword: vi.fn() };
});

import { changePassword } from "@/lib/api/auth.api";

const mockedChangePassword = vi.mocked(changePassword);

function fillForm(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    mockedChangePassword.mockReset();
  });

  it("shows validation errors when submitted empty", async () => {
    render(<ChangePasswordForm />);
    submit();

    expect(await screen.findByText("Current password is required")).toBeInTheDocument();
    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Please confirm your new password")).toBeInTheDocument();
    expect(mockedChangePassword).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that does not match", async () => {
    render(<ChangePasswordForm />);
    fillForm("secret-123", "brand-new-1", "different-1");
    submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockedChangePassword).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password", async () => {
    render(<ChangePasswordForm />);
    fillForm("secret-123", "secret-123", "secret-123");
    submit();

    expect(
      await screen.findByText("New password must be different from the current one"),
    ).toBeInTheDocument();
    expect(mockedChangePassword).not.toHaveBeenCalled();
  });

  it("submits the change and confirms success", async () => {
    mockedChangePassword.mockResolvedValue(undefined);
    render(<ChangePasswordForm />);
    fillForm("secret-123", "brand-new-1", "brand-new-1");
    submit();

    expect(await screen.findByText("Your password has been updated.")).toBeInTheDocument();
    expect(mockedChangePassword).toHaveBeenCalledWith({
      currentPassword: "secret-123",
      newPassword: "brand-new-1",
      confirmNewPassword: "brand-new-1",
    });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("surfaces the server refusal when the current password is wrong", async () => {
    mockedChangePassword.mockRejectedValue(
      Object.assign(new Error("forbidden"), {
        isAxiosError: true,
        response: { data: { detail: "The current password is incorrect." } },
      }),
    );
    render(<ChangePasswordForm />);
    fillForm("wrong-pass", "brand-new-1", "brand-new-1");
    submit();

    expect(await screen.findByText("Password change failed")).toBeInTheDocument();
    expect(screen.getByText("The current password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Your password has been updated.")).not.toBeInTheDocument();
  });
});
