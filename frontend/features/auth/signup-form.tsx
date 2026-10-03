"use client";

import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupValues } from "@/lib/validations/auth.schemas";
import { countryOptions } from "@/config/countries";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { AuthCard } from "@/features/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { PasswordField } from "@/components/ui/password-field";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";

const sexOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export function SignUpForm() {
  const { signup, isPending, errorMessage } = useAuth();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      homeCountry: "",
      currentCity: "",
      currentCountry: "",
      terms: false,
    },
  });
  const terms = useWatch({ control, name: "terms" });
  const sex = useWatch({ control, name: "sex" });
  const homeCountry = useWatch({ control, name: "homeCountry" });
  const currentCountry = useWatch({ control, name: "currentCountry" });

  return (
    <AuthCard>
      <div className="flex flex-col items-center gap-4 pb-6 mb-6">
        <Logo className="h-[100px] w-auto" />
        <Wordmark className="h-9 w-auto" />
      </div>
      <div className="flex flex-col gap-1.5 mb-7">
        <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
          Join LinQOrbit
        </h1>
        <p className="font-body-md text-body-md text-text-secondary">
          Create your LinQOrbit account.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) => signup(values))}
      >
        <TextField
          label="Email"
          icon="mail"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          placeholder="••••••••••••"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm password"
          placeholder="••••••••••••"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="First name"
            placeholder="Ada"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <TextField
            label="Last name"
            placeholder="Lovelace"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Sex"
            options={sexOptions}
            placeholder="Select one"
            value={sex}
            onValueChange={(optionValue) => setValue("sex", optionValue as SignupValues["sex"])}
            error={errors.sex?.message}
          />
          <TextField
            label="Phone"
            icon="call"
            type="tel"
            placeholder="+1 555 000 0000"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>
        <Select
          label="Country of origin"
          options={countryOptions}
          placeholder="Select a country"
          value={homeCountry}
          onValueChange={(optionValue) => setValue("homeCountry", optionValue)}
          error={errors.homeCountry?.message}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Current city"
            placeholder="Paris"
            autoComplete="address-level2"
            error={errors.currentCity?.message}
            {...register("currentCity")}
          />
          <Select
            label="Current country"
            options={countryOptions}
            placeholder="Select a country"
            value={currentCountry}
            onValueChange={(optionValue) => setValue("currentCountry", optionValue)}
            error={errors.currentCountry?.message}
          />
        </div>
        <div className="flex flex-col gap-1.5 pt-1 pb-2">
          <Checkbox
            label="I agree to the Terms of Service and Privacy Policy"
            checked={terms}
            {...register("terms")}
          />
          {errors.terms ? (
            <p className="font-body-sm text-body-sm text-error">{errors.terms.message}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={isPending}>
          <span>Create your account</span>
          <Icon name="arrow_forward" className="text-[20px] transition-transform group-hover:translate-x-1" />
        </Button>
      </form>

      {errorMessage ? (
        <Alert variant="error" title="Sign-up failed">
          {errorMessage}
        </Alert>
      ) : null}

      <p className="mt-6 text-center font-body-md text-body-md text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-label-md text-label-md text-primary-container hover:text-orange-deep transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
