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
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            <Logo className="h-6 w-auto" />
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
            className="flex items-center justify-between px-4 py-2 rounded-full bg-orange-subtle border border-orange-border text-orange-deep font-semibold transition-colors group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-primary-container text-canvas-white flex items-center justify-center shrink-0">
                <Icon name="grid_view" className="text-[16px]" />
              </span>
              <span className="text-xs font-semibold tracking-tight text-orange-deep">
                Overview
              </span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas-white border border-orange-border text-orange-deep text-[10px] font-mono font-bold tracking-wider uppercase shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" aria-hidden="true" />
              Active
            </span>
          </Link>

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
                      <span className="w-7 h-7 rounded-full bg-slate-surface text-slate-muted group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0">
                        <Icon name={item.icon} className="text-[16px]" />
                      </span>
                      <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded-full bg-orange-subtle text-orange-deep border border-orange-border">
                      {item.badge}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-7 h-7 rounded-full bg-slate-surface text-slate-muted group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0">
                      <Icon name={item.icon} className="text-[16px]" />
                    </span>
                    <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                  </>
                )}
              </button>
            );
          })}
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

        <button
          type="button"
          className="flex items-center gap-2 px-2 py-1.5 text-slate-muted hover:text-text-primary text-xs font-medium transition-colors cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        >
          <Icon name="help_outline" className="text-[16px] text-text-tertiary" />
          <span>API Help &amp; Documentation</span>
        </button>
      </div>
    </aside>
  );
}
