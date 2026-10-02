"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getAuthErrorMessage,
  login as loginRequest,
  signup as signupRequest,
  type AuthResponse,
} from "@/lib/api/auth.api";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginValues, SignupValues } from "@/lib/validations/auth.schemas";

export function useAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleSuccess = (data: AuthResponse) => {
    setAuth({ token: data.token, user: data.user });
    router.push("/dashboard");
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

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  return {
    signup: (values: SignupValues) => signup.mutate(values),
    login: (values: LoginValues) => login.mutate(values),
    logout,
    isPending: signup.isPending || login.isPending,
    errorMessage: error ? getAuthErrorMessage(error) : null,
  };
}
