"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { changePassword, getAuthErrorMessage } from "@/lib/api/auth.api";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/validations/auth.schemas";

export function ChangePasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordValues) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsPending(true);
    try {
      await changePassword(values);
      setSuccessMessage("Your password has been updated.");
      reset();
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Change password
        </h1>
        <p className="mt-1 text-body-md font-body-md text-text-secondary">
          Choose a strong password you have not used before.
        </p>
      </div>

      <section className="bg-canvas-white rounded-2xl p-6 shadow-sm">
        {serverError ? (
          <Alert variant="error" title="Password change failed" className="mt-0 mb-4">
            {serverError}
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert variant="success" title="Password updated" className="mt-0 mb-4">
            {successMessage}
          </Alert>
        ) : null}

        <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
          <PasswordField
            label="Current password"
            placeholder="••••••••••••"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register("currentPassword")}
          />
          <PasswordField
            label="New password"
            labelAction={
              <span className="text-body-sm font-body-sm text-text-tertiary">
                At least 8 characters
              </span>
            }
            placeholder="••••••••••••"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <PasswordField
            label="Confirm new password"
            placeholder="••••••••••••"
            autoComplete="new-password"
            error={errors.confirmNewPassword?.message}
            {...register("confirmNewPassword")}
          />

          <p className="text-body-sm font-body-sm text-text-secondary">
            You will stay signed in on this device after changing your password.
          </p>

          <Button type="submit" busy={isPending}>
            <span>Update password</span>
          </Button>
        </form>
      </section>
    </div>
  );
}
