"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { cn } from "@/lib/utils/cn";
import { useHeaderSearchStore } from "@/stores/header-search-store";

const SEARCH_INPUT_CLASS =
  "w-full pl-10 pr-12 py-2 rounded-full bg-canvas-subtle border border-slate-border text-body-sm font-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-container transition-[border-color] duration-150 ease-out";

/**
 * Top bar du dashboard : recherche + vue Candidate/Recruiter + notifications
 * (désactivées) + menu utilisateur. `collapsed` suit le repli du sidenav
 * (`DashboardShell`, T-40) : le bord gauche du header épouse le rail.
 *
 * Le champ de recherche a un rôle par page : une page qui sait chercher
 * (job board) le déclare via `useHeaderSearch`, le champ devient alors le sien
 * (libellé, placeholder, plafond, saisie) et reste visible sous `md` — sans
 * lui la recherche serait perdue sur mobile. Sans rôle déclaré, il reste le
 * champ d'origine, inerte.
 */
export function DashboardHeader({ collapsed }: { collapsed?: boolean }) {
  const role = useHeaderSearchStore((state) => state.role);
  const query = useHeaderSearchStore((state) => state.query);
  const setQuery = useHeaderSearchStore((state) => state.setQuery);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-16 bg-canvas-white/95 backdrop-blur-sm border-b border-slate-border z-40 flex items-center justify-between px-4 lg:px-8 gap-4",
        collapsed ? "left-0 lg:left-20" : "left-0 lg:left-64",
      )}
    >
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <Link
          href="/dashboard"
          className="lg:hidden flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          aria-label="Back to dashboard overview"
        >
          <Logo className="h-7 w-auto" strokeScale={1.75} />
        </Link>
        <div className={cn("relative w-full min-w-0 group", !role && "hidden md:block")}>
          <Icon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary-container text-[18px]"
          />
          {role ? (
            // `key` distinctes : sans elles React réutilise le même <input> d'une branche à l'autre
            // et bascule un champ non contrôlé en contrôlé (ou l'inverse) au changement de page.
            <input
              key="page-search"
              type="text"
              aria-label={role.label}
              placeholder={role.placeholder}
              maxLength={role.maxLength}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          ) : (
            <input
              key="default-search"
              type="text"
              aria-label="Search jobs"
              placeholder="Search jobs"
              className={SEARCH_INPUT_CLASS}
            />
          )}
          <kbd className="max-md:hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono border border-slate-border bg-canvas-white text-text-secondary px-2 py-0.5 rounded-full font-bold">
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
