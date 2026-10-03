import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";
import { NewCampaignButton } from "@/components/ui/new-campaign-button";

export function DashboardHeader() {
  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-canvas-white/95 backdrop-blur-sm border-b border-slate-border z-40 flex items-center justify-between px-4 lg:px-8 gap-4">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <Link
          href="/dashboard"
          className="lg:hidden flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          aria-label="Back to dashboard overview"
        >
          <Logo className="h-7 w-auto" />
        </Link>
        <div className="relative w-full hidden md:block">
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[18px]"
          />
          <input
            type="text"
            disabled
            aria-label="Search candidates, jobs, or ask the AI"
            placeholder="Search candidates, jobs, or ask the AI…"
            className="w-full pl-10 pr-12 py-2 rounded-full bg-canvas-subtle border border-slate-border text-body-sm font-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:cursor-not-allowed"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono border border-slate-border bg-canvas-white text-text-secondary px-2 py-0.5 rounded-full font-bold">
            ⌘K
          </kbd>
        </div>
        <div className="hidden xl:flex items-center border border-slate-border rounded-full p-1 bg-canvas-subtle" role="group" aria-label="Search segment">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-3 py-1 text-xs font-semibold rounded-full bg-canvas-white text-text-primary border border-slate-border cursor-not-allowed"
          >
            Tech &amp; Product
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-3 py-1 text-xs font-semibold rounded-full text-text-secondary cursor-not-allowed"
          >
            Sales &amp; Mktg
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="group inline-flex items-center gap-2 py-1 px-2.5 rounded-full text-orange-deep hover:text-canvas-white hover:bg-primary-container font-bold text-xs transition-[background-color,color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        >
          <span className="w-6 h-6 rounded-full bg-primary-container group-hover:bg-canvas-white text-canvas-white group-hover:text-primary-container flex items-center justify-center shrink-0 transition-colors duration-200">
            <Icon name="add" className="text-[16px]" />
          </span>
          <span className="leading-none transition-colors duration-200">New Job</span>
        </button>
        <span className="hidden sm:block">
          <NewCampaignButton />
        </span>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-subtle border border-primary-fixed-dim text-orange-deep font-bold text-xs cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="auto_awesome" className="text-[16px]" />
          <span className="hidden lg:inline">AI Sourcing</span>
        </button>
        <div className="h-5 w-[1px] bg-slate-border" aria-hidden="true" />
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="No new notifications"
          className="relative p-2 rounded-full border border-slate-border text-text-secondary cursor-not-allowed"
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
