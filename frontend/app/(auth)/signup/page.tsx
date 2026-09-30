import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — LinQOrbit",
  description: "Create your LinQOrbit recruitment account.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
