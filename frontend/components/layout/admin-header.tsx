"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/navigation/user-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useHeaderSearchStore } from "@/stores/header-search-store";

/** Mêmes tokens que le champ de `DashboardHeader` (qui reste intact : il héberge la bascule de mode D17). */
const SEARCH_INPUT_CLASS =
  "w-full pl-10 pr-4 py-2 rounded-full bg-canvas-subtle border border-slate-border text-body-sm font-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-container transition-[border-color] duration-150 ease-out";

/**
 * Barre supérieure de la console admin (D93) : le menu utilisateur en haut à
 * droite, comme sur le dashboard candidat/recruteur. Volontairement plus nue
 * que `DashboardHeader` — ni bascule Candidate/Recruiter, ni notifications :
 * la console n'a rien d'inerte à montrer. Même géométrie (`h-16`, mêmes
 * tokens) ; `collapsed` suit le repli du sidenav admin (`lg:left-20` ↔
 * `lg:left-64`). Le logo n'apparaît que sous `lg`, où la sidenav (et son logo)
 * est masquée.
 *
 * Le champ de recherche n'existe que si la page courante a déclaré un rôle via
 * `useHeaderSearch` (comptes, offres — T-110, D96) : il devient le sien
 * (libellé, placeholder, plafond, saisie) et reste visible sous `md`. Sans
 * rôle, **aucun champ** — pas de champ inerte, et pas d'indice « ⌘K » :
 * aucun raccourci n'existe ici.
 */
export function AdminHeader({ collapsed }: { collapsed?: boolean }) {
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
          href="/admin"
          className="lg:hidden flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          aria-label="Administration home"
        >
          <Logo className="h-7 w-auto" strokeScale={1.75} />
        </Link>
        {role ? (
          <div className="relative w-full min-w-0 group">
            <Icon
              name="search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary-container text-[18px]"
            />
            <input
              type="text"
              aria-label={role.label}
              placeholder={role.placeholder}
              maxLength={role.maxLength}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={SEARCH_INPUT_CLASS}
            />
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}
