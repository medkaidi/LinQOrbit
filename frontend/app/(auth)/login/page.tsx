import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { safeReturnTo } from "@/features/auth/return-to";

export const metadata: Metadata = {
  title: "Sign in — LinQOrbit",
  description: "Sign in to your LinQOrbit recruitment workspace.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return <LoginForm returnTo={safeReturnTo(params.next)} />;
}
