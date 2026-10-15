import { DashboardShell } from "@/components/layout/dashboard-sidebar";
import { AuthGate } from "@/features/auth/auth-gate";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
