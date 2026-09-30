import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — LinQOrbit",
  description: "Sign in to your LinQOrbit recruitment workspace.",
};

export default function LoginPage() {
  return <LoginForm />;
}
