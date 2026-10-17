import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const PAGE_HEADER_CLASS = "pb-6 border-b border-slate-border";
const PAGE_TITLE_CLASS =
  "font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight";
const BREADCRUMB_CLASS =
  "flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary";

/**
 * Accent hover/focus commun des liens texte du chrome (breadcrumbs,
 * titres-liens, liens externes) — une seule définition pour tous les sites
 * (TD-040).
 */
export const LINK_ACCENT_CLASS =
  "hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

export function Breadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className={BREADCRUMB_CLASS}>
      {children}
    </nav>
  );
}

export function BreadcrumbLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LINK_ACCENT_CLASS}>
      {children}
    </Link>
  );
}

export function BreadcrumbSeparator() {
  return (
    <span aria-hidden="true" className="text-text-tertiary">
      /
    </span>
  );
}

export function BreadcrumbCurrent({ children }: { children: ReactNode }) {
  return <span className="text-text-primary font-semibold">{children}</span>;
}

type PageHeaderProps = {
  as?: "div" | "header";
  breadcrumb: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
};

/**
 * En-tête de page du chrome : filet + breadcrumb + h1 [± sous-titre, ±
 * action à droite] — même anatomie pour toutes les vues (TD-040). `children`
 * accueille une ligne complémentaire sous le titre (ex. email du compte).
 */
export function PageHeader({
  as = "div",
  breadcrumb,
  title,
  subtitle,
  action,
  children,
}: PageHeaderProps) {
  const Wrapper = as;
  return (
    <Wrapper className={PAGE_HEADER_CLASS}>
      {breadcrumb}
      {action ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className={cn(PAGE_TITLE_CLASS, "min-w-0")}>{title}</h1>
          {action}
        </div>
      ) : (
        <h1 className={cn(PAGE_TITLE_CLASS, "mt-1")}>{title}</h1>
      )}
      {subtitle ? (
        <p className="mt-1 text-body-md font-body-md text-text-secondary">{subtitle}</p>
      ) : null}
      {children}
    </Wrapper>
  );
}
