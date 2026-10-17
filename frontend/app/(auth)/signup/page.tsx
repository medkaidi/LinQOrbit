import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/signup-form";
import { safeReturnTo } from "@/features/auth/return-to";

export const metadata: Metadata = {
  title: "Sign up — LinQOrbit",
  description: "Create your LinQOrbit recruitment account.",
};

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  return <SignUpForm returnTo={safeReturnTo(params.next)} />;
}
