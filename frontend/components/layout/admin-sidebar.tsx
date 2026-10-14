"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";

type SidebarLinkProps = {
  href: string;
  icon: string;
  label: string;
  active: boolean;
};

const SIDEBAR_ITEM_CLASS =
  "flex items-center gap-2.5 px-3 py-2 rounded-full border group transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const SIDEBAR_ITEM_ACTIVE_CLASS = `${SIDEBAR_ITEM_CLASS} bg-orange-subtle border-orange-border text-orange-deep`;
const SIDEBAR_ITEM_IDLE_CLASS = `${SIDEBAR_ITEM_CLASS} border-transparent text-text-secondary hover:text-text-primary hover:bg-slate-surface`;
const SIDEBAR_ICON_ACTIVE_CLASS =
  "w-7 h-7 rounded-full bg-primary-container text-canvas-white flex items-center justify-center shrink-0";
const SIDEBAR_ICON_IDLE_CLASS =
  "w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0";
const SIDEBAR_LABEL_CLASS = "text-xs font-semibold tracking-tight";

function SidebarLink({ href, icon, label, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? SIDEBAR_ITEM_ACTIVE_CLASS : SIDEBAR_ITEM_IDLE_CLASS}
    >
      <span className="flex items-center gap-2.5">
        <span className={active ? SIDEBAR_ICON_ACTIVE_CLASS : SIDEBAR_ICON_IDLE_CLASS}>
          <Icon name={icon} className="text-[16px]!" />
        </span>
        <span className={active ? `${SIDEBAR_LABEL_CLASS} text-orange-deep` : SIDEBAR_LABEL_CLASS}>
          {label}
        </span>
      </span>
    </Link>
  );
}

/**
 * Chrome admin (D33) : rubriques Accounts & suggestions + Offers, retour au
 * dashboard, menu utilisateur en pied — volontairement distinct du chrome
 * candidat/recruteur (DashboardSidebar).
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-canvas-white border-r border-slate-border z-50 flex-col justify-between pb-5">
      <div className="flex flex-col">
        <div className="h-16 mx-5 flex items-center">
          <Link
            href="/admin"
            aria-label="Administration home"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            <Logo className="h-6 w-auto" strokeScale={2} />
            <Wordmark className="h-6 w-auto" />
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Administration">
          <SidebarLink
            href="/admin"
            icon="group"
            label="Accounts & suggestions"
            active={pathname === "/admin"}
          />
          <SidebarLink
            href="/admin/offers"
            icon="description"
            label="Offers"
            active={pathname.startsWith("/admin/offers")}
          />
        </nav>

        <div className="mx-3 mt-4 pt-4 border-t border-slate-border">
          <SidebarLink
            href="/dashboard"
            icon="grid_view"
            label="Back to dashboard"
            active={false}
          />
        </div>
      </div>

      <div className="px-3">
        <UserMenu />
      </div>
    </aside>
  );
}
