import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminGate } from "@/features/admin/admin-gate";
import { AuthGate } from "@/features/auth/auth-gate";

/**
 * Zone administration (D33) : chrome séparé du dashboard — AdminSidebar
 * dédiée, pas de DashboardHeader (chaque vue rend son propre fil d'Ariane et
 * son h1).
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AuthGate>
      <AdminGate>
        <div className="min-h-screen bg-canvas-subtle antialiased selection:bg-orange-subtle selection:text-orange-deep">
          <AdminSidebar />
          <main className="lg:pl-64">
            <div className="w-full px-gutter py-7 flex flex-col gap-6">{children}</div>
          </main>
        </div>
      </AdminGate>
    </AuthGate>
  );
}
