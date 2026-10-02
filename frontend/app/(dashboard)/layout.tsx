import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { AuthGate } from "@/features/auth/auth-gate";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-canvas-subtle antialiased selection:bg-orange-subtle selection:text-orange-deep">
        <DashboardSidebar />
        <DashboardHeader />
        <main className="pt-16 lg:pl-64">
          <div className="max-w-7xl mx-auto px-gutter py-7 flex flex-col gap-6">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
