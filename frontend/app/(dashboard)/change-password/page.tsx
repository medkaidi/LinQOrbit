import type { Metadata } from "next";

import { ChangePasswordForm } from "@/features/auth/change-password-form";

export const metadata: Metadata = {
  title: "Change password — LinQOrbit",
  description: "Update the password of your LinQOrbit account.",
};

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
