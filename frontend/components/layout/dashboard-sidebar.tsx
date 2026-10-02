import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/ui/icon";

const NAV_ITEMS = [
  { icon: "view_kanban", label: "Offers & Pipelines" },
  { icon: "group", label: "Candidate Pool" },
  { icon: "smart_toy", label: "AI Agents Studio", badge: "3 AI" },
  { icon: "assignment_turned_in", label: "Interviews & Evaluations" },
  { icon: "tune", label: "Settings & Integrations" },
] as const;

export function DashboardSidebar() {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-canvas-white border-r border-slate-border z-50 flex-col justify-between py-5">
      <div className="flex flex-col">
        <div className="px-5 pb-5 border-b border-slate-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 focus:outline-none">
            <Logo className="h-8 w-auto" />
            <Wordmark className="h-6 w-auto" />
          </Link>
        </div>

        <div className="px-5 pt-5 pb-2">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider font-mono">
            Recruitment Navigation
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-3" aria-label="Dashboard">
          <Link
            href="/dashboard"
            aria-current="page"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-full font-bold text-xs bg-text-primary text-canvas-white tracking-wide"
          >
            <span className="flex items-center gap-2.5">
              <Icon name="grid_view" className="text-[18px] text-orange-vibrant" />
              <span>Overview</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-orange-vibrant" aria-hidden="true" />
          </Link>

          {NAV_ITEMS.map((item) => (
            <span
              key={item.label}
              aria-disabled="true"
              title="Coming soon"
              className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-full font-semibold text-xs text-text-tertiary cursor-not-allowed select-none"
            >
              <span className="flex items-center gap-2.5">
                <Icon name={item.icon} className="text-[18px] text-text-tertiary" />
                <span>{item.label}</span>
              </span>
              {"badge" in item && item.badge ? (
                <span className="rounded-full bg-orange-subtle text-orange-deep px-2 py-0.5 text-[10px] font-bold">
                  {item.badge}
                </span>
              ) : null}
            </span>
          ))}
        </nav>
      </div>

      <div className="px-3 flex flex-col gap-2">
        <div className="rounded-xl bg-canvas-subtle border border-slate-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="monitoring" className="text-[16px] text-orange-deep" />
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

        <span
          aria-disabled="true"
          title="Coming soon"
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full font-semibold text-xs text-text-tertiary cursor-not-allowed select-none"
        >
          <Icon name="help_outline" className="text-[18px] text-text-tertiary" />
          <span>API Help &amp; Documentation</span>
        </span>
      </div>
    </aside>
  );
}
