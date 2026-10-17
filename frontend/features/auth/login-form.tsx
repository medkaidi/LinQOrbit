"use client";

import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginValues } from "@/lib/validations/auth.schemas";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { AuthCard } from "@/features/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";

/**
 * Formulaire de connexion — `returnTo` (chemin interne déjà validé par
 * `safeReturnTo`) ramène l'utilisateur à la route demandée et se propage au
 * lien « Sign up » pour survivre à la création de compte.
 */
export function LoginForm({ returnTo }: { returnTo?: string | null }) {
  const { login, isPending, errorMessage } = useAuth(returnTo);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const remember = useWatch({ control, name: "remember" });

  return (
    <AuthCard>
      <div className="flex flex-col items-center gap-4 pb-6 mb-6">
        <Logo className="h-[100px] w-auto" />
        <Wordmark className="h-9 w-auto" />
      </div>
      <div className="flex flex-col gap-1.5 mb-7">
        <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
          Welcome back
        </h1>
        <p className="font-body-md text-body-md text-text-secondary">
          Sign in to your LinQOrbit account.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) => login(values))}
      >
        <TextField
          label="Email"
          icon="mail"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          placeholder="••••••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="flex items-center justify-between pt-1 pb-2">
          <Checkbox
            label="Remember me for 30 days"
            checked={remember}
            {...register("remember")}
          />
          <a
            href="#"
            className="font-label-md text-label-md text-primary-container hover:text-orange-deep transition-colors"
          >
            Forgot password?
          </a>
        </div>
        <Button type="submit" busy={isPending}>
          <span>Sign in to your workspace</span>
          <Icon name="arrow_forward" className="text-[20px] transition-transform group-hover:translate-x-1" />
        </Button>
      </form>

      {errorMessage ? (
        <Alert variant="error" title="Sign-in failed">
          {errorMessage}
        </Alert>
      ) : null}

      <p className="mt-6 text-center font-body-md text-body-md text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href={returnTo ? `/signup?next=${encodeURIComponent(returnTo)}` : "/signup"}
          className="font-label-md text-label-md text-primary-container hover:text-orange-deep transition-colors"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
