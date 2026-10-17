"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getAuthErrorMessage,
  login as loginRequest,
  signup as signupRequest,
} from "@/lib/api/auth.api";
import { useAuthStore } from "@/stores/auth-store";
import { useViewModeStore } from "@/stores/view-mode-store";
import type { LoginValues, SignupValues } from "@/lib/validations/auth.schemas";
import type { AuthResponse } from "@/types/auth";

export function useAuth(returnTo?: string | null) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleSuccess = (data: AuthResponse) => {
    setAuth({ token: data.token, user: data.user });
    // Raccorde le mode de vue à la préférence de ce compte (D18) : un login
    // après logout retrouve le mode choisi, un autre compte démarre en candidat.
    useViewModeStore.getState().restoreForUser(data.user.id);
    router.push(returnTo ?? "/dashboard");
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
