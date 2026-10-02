import { AuthShell } from "@/features/auth/auth-shell";
import { RedirectIfAuthenticated } from "@/features/auth/redirect-if-authenticated";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <RedirectIfAuthenticated>
      <AuthShell>{children}</AuthShell>
    </RedirectIfAuthenticated>
  );
}
