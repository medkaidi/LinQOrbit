import { AdminShell } from "@/components/layout/admin-sidebar";
import { AdminGate } from "@/features/admin/admin-gate";
import { AuthGate } from "@/features/auth/auth-gate";

/**
 * Zone administration (D33) : chrome séparé du dashboard — AdminSidebar et
 * AdminHeader dédiés (menu utilisateur en haut à droite, D93), pas de
 * DashboardHeader (chaque vue rend son propre fil d'Ariane et son h1). Le
 * shell suit le repli du sidenav (D40).
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AuthGate>
      <AdminGate>
        <AdminShell>{children}</AdminShell>
      </AdminGate>
    </AuthGate>
  );
}
