"use client";

import { useEffect, type ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";
import { useAdminSidebarStore } from "@/stores/admin-sidebar-store";
import { cn } from "@/lib/utils/cn";

type SidebarLinkProps = {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
};

const SIDEBAR_ITEM_CLASS =
  "flex items-center gap-2.5 py-2 rounded-full border group transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const SIDEBAR_ITEM_ACTIVE_CLASS = `${SIDEBAR_ITEM_CLASS} bg-orange-subtle border-orange-border text-orange-deep`;
const SIDEBAR_ITEM_IDLE_CLASS = `${SIDEBAR_ITEM_CLASS} border-transparent text-text-secondary hover:text-text-primary hover:bg-slate-surface`;
const SIDEBAR_ICON_ACTIVE_CLASS =
  "w-7 h-7 rounded-full bg-primary-container text-canvas-white flex items-center justify-center shrink-0";
const SIDEBAR_ICON_IDLE_CLASS =
  "w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0";
const SIDEBAR_LABEL_CLASS = "text-xs font-semibold tracking-tight";

function SidebarLink({ href, icon, label, active, collapsed }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        active ? SIDEBAR_ITEM_ACTIVE_CLASS : SIDEBAR_ITEM_IDLE_CLASS,
        collapsed ? "justify-center px-0" : "px-3",
      )}
    >
      <span className="flex items-center gap-2.5">
        <span className={active ? SIDEBAR_ICON_ACTIVE_CLASS : SIDEBAR_ICON_IDLE_CLASS}>
          <Icon name={icon} className="text-[16px]!" />
        </span>
        {!collapsed && (
          <span
            className={active ? `${SIDEBAR_LABEL_CLASS} text-orange-deep` : SIDEBAR_LABEL_CLASS}
          >
            {label}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Chrome admin (D33) : rubriques Accounts & suggestions + Offers, retour au
 * dashboard, menu utilisateur en pied — volontairement distinct du chrome
 * candidat/recruteur (DashboardSidebar). Repliable en rail icônes (D40,
 * état persisté `linqorbit.adminSidebar`) : labels masqués + `aria-label`,
 * Wordmark et bloc nom du UserMenu masqués, toggle compact en haut à droite
 * du conteneur logo (`rounded-xl` sans bordure, distinct des nav links
 * `rounded-full` bordés).
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const collapsed = useAdminSidebarStore((state) => state.collapsed);
  const toggle = useAdminSidebarStore((state) => state.toggle);

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
            href="/admin"
            aria-label="Administration home"
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
            <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-[16px]!" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Administration">
          <SidebarLink
            href="/admin"
            icon="group"
            label="Accounts & suggestions"
            active={pathname === "/admin"}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/admin/offers"
            icon="description"
            label="Offers"
            active={pathname.startsWith("/admin/offers")}
            collapsed={collapsed}
          />
        </nav>

        <div className="mx-3 mt-4 pt-4 border-t border-slate-border">
          <SidebarLink
            href="/dashboard"
            icon="grid_view"
            label="Back to dashboard"
            active={false}
            collapsed={collapsed}
          />
        </div>
      </div>

      <div className="px-3 flex flex-col gap-1">
        <UserMenu compact={collapsed} />
      </div>
    </aside>
  );
}

/**
 * Shell de la zone admin : sidebar + `main` dont le padding suit le repli
 * (`lg:pl-64` ↔ `lg:pl-20`, D40). Client (store Zustand) — le layout de
 * route l'enveloppe sous les gates.
 *
 * Expose aussi la largeur de la sidenav en `--sidenav-w` sur `<html>` :
 * c'est la source de vérité pour le drawer normalisé (50 % du contenu hors
 * sidenav — posée sur `<html>`, pas sur ce div, car le drawer est portailé
 * sur `<body>` et n'hériterait pas de la var).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const collapsed = useAdminSidebarStore((state) => state.collapsed);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidenav-w", collapsed ? "5rem" : "16rem");
    return () => {
      root.style.removeProperty("--sidenav-w");
    };
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-canvas-subtle antialiased selection:bg-orange-subtle selection:text-orange-deep">
      <AdminSidebar />
      <main className={collapsed ? "lg:pl-20" : "lg:pl-64"}>
        <div className="w-full px-gutter py-7 flex flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
