"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SidebarLink } from "@/components/layout/sidebar-link";
import { Icon } from "@/components/ui/icon";
import { useViewMode } from "@/hooks/use-view-mode";
import { isAdmin } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardSidebarStore } from "@/stores/dashboard-sidebar-store";
import { cn } from "@/lib/utils/cn";

/**
 * Sidenav candidat/recruteur, repliable en rail icônes (T-40, état persisté
 * `linqorbit.dashboardSidebar`) : toggle compact en haut à droite du
 * conteneur logo (`rounded-xl` sans bordure), labels masqués en rail,
 * `aria-label` sur les liens repliés — même pattern que `AdminSidebar` (D40).
 * Aucun élément factice ou inerte : ni entrées sans page, ni télémétrie, ni aide.
 */
export function DashboardSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { mode } = useViewMode();
  const collapsed = useDashboardSidebarStore((state) => state.collapsed);
  const toggle = useDashboardSidebarStore((state) => state.toggle);

  const isRecruiterMode = mode === "recruiter";

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed left-0 top-0 h-full bg-canvas-white border-r border-slate-border z-50 flex-col justify-between pb-5",
        collapsed ? "lg:w-20" : "lg:w-64"
      )}
    >
      <div className="flex flex-col">
        <div
          className={cn(
            "relative h-16 flex items-center gap-1",
            collapsed ? "mx-2 justify-center" : "mx-3"
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Dashboard home"
            className={cn(
              "flex items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
              collapsed ? "p-1.5" : "gap-2.5 px-3 py-2"
            )}
          >
            {/* Un cran plus fin que le trait du wordmark (Q / O) posé à droite. */}
            <Logo className="h-5 w-auto" strokeScale={1.75} />
            {!collapsed && <Wordmark className="h-5 w-auto" />}
          </Link>
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "flex items-center justify-center shrink-0 rounded-full text-text-secondary hover:text-text-primary hover:bg-slate-surface transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
              collapsed
                ? "absolute -right-1.5 top-1/2 -translate-y-1/2 w-6 h-6"
                : "ml-auto w-7 h-7"
            )}
          >
            <Icon
              name={collapsed ? "chevron_right" : "chevron_left"}
              className="text-[16px]"
            />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Dashboard">
          <SidebarLink
            href="/dashboard"
            icon="grid_view"
            label="Overview"
            active={pathname === "/dashboard"}
            collapsed={collapsed}
          />
          {isRecruiterMode ? (
            <>
              <SidebarLink
                href="/recruiter"
                icon="description"
                label="Offers"
                active={
                  pathname.startsWith("/recruiter") &&
                  !pathname.startsWith("/recruiter/settings")
                }
                collapsed={collapsed}
              />
              <SidebarLink
                href="/recruiter/settings"
                icon="tune"
                label="Settings"
                active={pathname.startsWith("/recruiter/settings")}
                collapsed={collapsed}
              />
            </>
          ) : (
            <>
              <SidebarLink
                href="/profile"
                icon="person"
                label="Profile"
                active={pathname.startsWith("/profile")}
                collapsed={collapsed}
              />
              {/* Job board public (T-72) : remplace l'ancien placeholder « Offers & Pipelines ». */}
              <SidebarLink
                href="/jobs"
                icon="work"
                label="Browse offers"
                active={pathname.startsWith("/jobs")}
                collapsed={collapsed}
              />
              <SidebarLink
                href="/applications"
                icon="work_history"
                label="My applications"
                active={pathname.startsWith("/applications")}
                collapsed={collapsed}
              />
            </>
          )}
        </nav>

        {isAdmin(user) && (
          <div className="mx-3 mt-4 pt-4 border-t border-slate-border">
            <SidebarLink
              href="/admin"
              icon="admin_panel_settings"
              label="Administration"
              active={pathname.startsWith("/admin")}
              collapsed={collapsed}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Shell de la zone dashboard (candidat/recruteur) : sidebar + header + `main`
 * dont le padding suit le repli (`lg:pl-64` ↔ `lg:pl-20`, T-40) — miroir
 * d'`AdminShell`. Client (store Zustand) — le layout de route l'enveloppe
 * sous le gate.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const collapsed = useDashboardSidebarStore((state) => state.collapsed);

  return (
    <div className="min-h-screen bg-canvas-subtle antialiased selection:bg-orange-subtle selection:text-orange-deep">
      <DashboardSidebar />
      <DashboardHeader collapsed={collapsed} />
      <main className={cn("pt-16", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        <div className="w-full px-gutter py-7 flex flex-col gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}
