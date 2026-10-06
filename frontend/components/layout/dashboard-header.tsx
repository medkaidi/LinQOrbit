import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";

export function DashboardHeader() {
  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-canvas-white/95 backdrop-blur-sm border-b border-slate-border z-40 flex items-center justify-between px-4 lg:px-8 gap-4">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <Link
          href="/dashboard"
          className="lg:hidden flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          aria-label="Back to dashboard overview"
        >
          <Logo className="h-7 w-auto" strokeScale={2} />
        </Link>
        <div className="relative w-full hidden md:block group">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary-container text-[18px]"
          />
          <input
            type="text"
            aria-label="Search jobs"
            placeholder="Search jobs"
            className="w-full pl-10 pr-12 py-2 rounded-full bg-canvas-subtle border border-slate-border text-body-sm font-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-container transition-[border-color] duration-150 ease-out"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono border border-slate-border bg-canvas-white text-text-secondary px-2 py-0.5 rounded-full font-bold">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ViewModeToggle />
        <div className="h-5 w-[1px] bg-slate-border" aria-hidden="true" />
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="No new notifications"
          className="relative size-9 flex items-center justify-center rounded-full border border-slate-border text-text-secondary cursor-not-allowed"
          aria-label="Notifications"
        >
          <Icon name="notifications" className="text-[20px]" />
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-vibrant ring-2 ring-canvas-white"
            aria-hidden="true"
          />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
