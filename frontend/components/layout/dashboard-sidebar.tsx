"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";
import { isAdmin } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";

const NAV_ITEMS = [
  { icon: "view_kanban", label: "Offers & Pipelines" },
  { icon: "group", label: "Candidate Pool" },
  { icon: "smart_toy", label: "AI Agents Studio", badge: "3 AI" },
  { icon: "assignment_turned_in", label: "Interviews & Evaluations" },
  { icon: "tune", label: "Settings & Integrations" },
] as const;

type SidebarLinkProps = {
  href: string;
  icon: string;
  label: string;
  active: boolean;
};

function SidebarLink({ href, icon, label, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-2.5 px-4 py-2 rounded-full bg-orange-subtle border border-orange-border text-orange-deep transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          : "flex items-center gap-2.5 px-4 py-2 rounded-full border border-transparent text-text-secondary hover:text-text-primary hover:bg-slate-surface transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
      }
    >
      <span className="flex items-center gap-2.5">
        <span
          className={
            active
              ? "w-7 h-7 rounded-full bg-primary-container text-canvas-white flex items-center justify-center shrink-0"
              : "w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0"
          }
        >
          <Icon name={icon} className="text-[16px]!" />
        </span>
        <span
          className={
            active
              ? "text-xs font-semibold tracking-tight text-orange-deep"
              : "text-xs font-semibold tracking-tight"
          }
        >
          {label}
        </span>
      </span>
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-canvas-white border-r border-slate-border z-50 flex-col justify-between pb-5">
      <div className="flex flex-col">
        <div className="h-16 mx-5 flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            <Logo className="h-6 w-auto" strokeScale={2} />
            <Wordmark className="h-6 w-auto" />
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Dashboard">
          <SidebarLink
            href="/dashboard"
            icon="grid_view"
            label="Overview"
            active={pathname === "/dashboard"}
          />
          <SidebarLink
            href="/profile"
            icon="person"
            label="Profile"
            active={pathname.startsWith("/profile")}
          />

          {NAV_ITEMS.map((item) => {
            const hasBadge = "badge" in item && Boolean(item.badge);
            return (
              <button
                key={item.label}
                type="button"
                className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-slate-surface transition-colors cursor-pointer group text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${
                  hasBadge ? "justify-between" : ""
                }`}
              >
                {hasBadge ? (
                  <>
                    <span className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0">
                        <Icon name={item.icon} className="text-[16px]!" />
                      </span>
                      <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded-full bg-orange-subtle text-orange-deep border border-orange-border">
                      {item.badge}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0">
                      <Icon name={item.icon} className="text-[16px]!" />
                    </span>
                    <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {isAdmin(user) && (
          <div className="mx-3 mt-4 pt-4 border-t border-slate-border">
            <SidebarLink
              href="/admin"
              icon="admin_panel_settings"
              label="Administration"
              active={pathname.startsWith("/admin")}
            />
          </div>
        )}
      </div>

      <div className="px-3 flex flex-col gap-2">
        <div className="rounded-xl bg-canvas-subtle border border-slate-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="monitoring" className="text-[16px]! text-orange-deep" />
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
              AI Telemetry
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-lg text-headline-lg font-bold text-orange-deep">98%</span>
            <span className="text-body-sm font-body-sm text-text-secondary">live</span>
          </div>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
            3 agents actively sourcing and ranking in real time.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-2 py-1.5 text-slate-muted hover:text-text-primary text-xs font-medium transition-colors cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        >
          <Icon name="help_outline" className="text-[16px]! text-text-tertiary" />
          <span>API Help &amp; Documentation</span>
        </button>
      </div>
    </aside>
  );
}
