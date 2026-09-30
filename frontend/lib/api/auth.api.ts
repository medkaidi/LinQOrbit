import { api } from "@/lib/api/axios";
import type { LoginValues, SignupValues } from "@/lib/validations/auth.schemas";
import { isAxiosError } from "axios";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sex: string;
  phone: string | null;
  homeCountry: string;
  currentCity: string;
  currentCountry: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export async function signup(values: SignupValues): Promise<AuthResponse> {
  const payload = {
    email: values.email,
    password: values.password,
    firstName: values.firstName,
    lastName: values.lastName,
    sex: values.sex,
    phone: values.phone,
    homeCountry: values.homeCountry,
    currentCity: values.currentCity,
    currentCountry: values.currentCountry,
  };
  const response = await api.post<AuthResponse>("/api/v1/auth/signup", payload);
  return response.data;
}

export async function login(values: LoginValues): Promise<AuthResponse> {
  const payload = {
    email: values.email,
    password: values.password,
  };
  const response = await api.post<AuthResponse>("/api/v1/auth/login", payload);
  return response.data;
}

type ProblemDetailBody = {
  detail?: string;
  title?: string;
};

export function getAuthErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Cannot reach the server. Please try again.";
    }
    const data = error.response.data as ProblemDetailBody | undefined;
    if (data?.detail) {
      return data.detail;
    }
    if (data?.title) {
      return data.title;
    }
  }
  return "Something went wrong. Please try again.";
}
