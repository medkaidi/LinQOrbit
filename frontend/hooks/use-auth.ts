"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getAuthErrorMessage,
  login as loginRequest,
  signup as signupRequest,
  type AuthResponse,
} from "@/lib/api/auth.api";
import type { LoginValues, SignupValues } from "@/lib/validations/auth.schemas";

const TOKEN_STORAGE_KEY = "linqorbit.token";

export function useAuth() {
  const router = useRouter();

  const handleSuccess = (data: AuthResponse) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    router.push("/");
  };

  const signup = useMutation({
    mutationFn: (values: SignupValues) => signupRequest(values),
    onSuccess: handleSuccess,
  });
  const login = useMutation({
    mutationFn: (values: LoginValues) => loginRequest(values),
    onSuccess: handleSuccess,
  });

  const error = signup.error ?? login.error;

  return {
    signup: (values: SignupValues) => signup.mutate(values),
    login: (values: LoginValues) => login.mutate(values),
    isPending: signup.isPending || login.isPending,
    errorMessage: error ? getAuthErrorMessage(error) : null,
  };
}
