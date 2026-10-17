"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  SidebarLink,
  SIDEBAR_ICON_IDLE_CLASS,
  SIDEBAR_ITEM_IDLE_CLASS,
  SIDEBAR_LABEL_CLASS,
} from "@/components/layout/sidebar-link";
import { Icon } from "@/components/ui/icon";
import { useViewMode } from "@/hooks/use-view-mode";
import { isAdmin } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardSidebarStore } from "@/stores/dashboard-sidebar-store";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { icon: "group", label: "Candidate Pool" },
  { icon: "smart_toy", label: "AI Agents Studio", badge: "3 AI" },
  { icon: "assignment_turned_in", label: "Interviews & Evaluations" },
  { icon: "tune", label: "Settings & Integrations" },
] as const;

const SIDEBAR_ITEM_BUTTON_CLASS = `${SIDEBAR_ITEM_IDLE_CLASS} cursor-pointer text-left`;

function SidebarPlaceholderButton({
  item,
  collapsed,
}: {
  item: (typeof NAV_ITEMS)[number];
  collapsed: boolean;
}) {
  const hasBadge = "badge" in item && Boolean(item.badge);
  return (
    <button
      type="button"
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        SIDEBAR_ITEM_BUTTON_CLASS,
        hasBadge && !collapsed && "justify-between",
        collapsed ? "justify-center px-0" : "px-3",
      )}
    >
      {hasBadge ? (
        <>
          <span className="flex items-center gap-2.5">
            <span className={SIDEBAR_ICON_IDLE_CLASS}>
              <Icon name={item.icon} className="text-[16px]" />
            </span>
            {!collapsed && <span className={SIDEBAR_LABEL_CLASS}>{item.label}</span>}
          </span>
          {!collapsed && (
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded-full bg-orange-subtle text-orange-deep border border-orange-border">
              {item.badge}
            </span>
          )}
        </>
      ) : (
        <>
          <span className={SIDEBAR_ICON_IDLE_CLASS}>
            <Icon name={item.icon} className="text-[16px]" />
          </span>
          {!collapsed && <span className={SIDEBAR_LABEL_CLASS}>{item.label}</span>}
        </>
      )}
    </button>
  );
}

/**
 * Sidenav candidat/recruteur, repliable en rail icônes (T-40, état persisté
 * `linqorbit.dashboardSidebar`) : toggle compact en haut à droite du
 * conteneur logo (`rounded-xl` sans bordure), labels/badge « 3 AI »/carte AI
 * Telemetry masqués en rail (API Help en icône seule), `aria-label` sur les
 * liens et boutons repliés — même pattern que `AdminSidebar` (D40).
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
        collapsed ? "lg:w-20" : "lg:w-64",
      )}
    >
      <div className="flex flex-col">
        <div
          className={cn(
            "relative h-16 flex items-center gap-1",
            collapsed ? "mx-2 justify-center" : "mx-3",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Dashboard home"
            className={cn(
              "flex items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
              collapsed ? "p-1.5" : "gap-2.5 px-3 py-2",
            )}
          >
            <Logo className="h-5 w-auto" strokeScale={2} />
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
              collapsed ? "absolute -right-1.5 top-1/2 -translate-y-1/2 w-6 h-6" : "ml-auto w-7 h-7",
            )}
          >
            <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-[16px]" />
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
              {NAV_ITEMS.map((item) => (
                <SidebarPlaceholderButton key={item.label} item={item} collapsed={collapsed} />
              ))}
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

      <div className="px-3 flex flex-col gap-2">
        {!collapsed && (
          <div className="rounded-xl bg-canvas-subtle border border-slate-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="monitoring" className="text-[16px] text-orange-deep" />
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                AI Telemetry
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-orange-deep">
                98%
              </span>
              <span className="text-body-sm font-body-sm text-text-secondary">live</span>
            </div>
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
              3 agents actively sourcing and ranking in real time.
            </p>
          </div>
        )}

        <button
          type="button"
          aria-label={collapsed ? "API Help & Documentation" : undefined}
          title={collapsed ? "API Help & Documentation" : undefined}
          className={cn(
            "flex items-center gap-2 py-1.5 text-slate-muted hover:text-text-primary text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
            collapsed ? "justify-center px-0" : "px-2 text-left",
          )}
        >
          <Icon name="help_outline" className="text-[16px] text-text-tertiary" />
          {!collapsed && <span>API Help &amp; Documentation</span>}
        </button>
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
        <div className="w-full px-gutter py-7 flex flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
