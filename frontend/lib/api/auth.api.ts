import { api } from "@/lib/api/axios";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type {
  ChangePasswordValues,
  LoginValues,
  SignupValues,
} from "@/lib/validations/auth.schemas";

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

export async function me(): Promise<AuthUser> {
  const response = await api.get<AuthUser>("/api/v1/auth/me");
  return response.data;
}

export async function changePassword(values: ChangePasswordValues): Promise<void> {
  await api.post("/api/v1/auth/change-password", {
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
  });
}

export function getAuthErrorMessage(error: unknown): string {
  return getApiErrorMessage(error);
}
