import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type SidebarLinkProps = {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
};

export const SIDEBAR_ITEM_CLASS =
  "flex items-center gap-2.5 py-2 rounded-full border group transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
export const SIDEBAR_ITEM_ACTIVE_CLASS = `${SIDEBAR_ITEM_CLASS} bg-orange-subtle border-orange-border text-orange-deep`;
export const SIDEBAR_ITEM_IDLE_CLASS = `${SIDEBAR_ITEM_CLASS} border-transparent text-text-secondary hover:text-text-primary hover:bg-slate-surface`;
export const SIDEBAR_ICON_ACTIVE_CLASS =
  "w-7 h-7 rounded-full bg-primary-container text-canvas-white flex items-center justify-center shrink-0";
export const SIDEBAR_ICON_IDLE_CLASS =
  "w-7 h-7 rounded-full bg-slate-surface text-slate-muted flex items-center justify-center group-hover:bg-canvas-white group-hover:text-text-primary transition-colors shrink-0";
export const SIDEBAR_LABEL_CLASS = "text-xs font-semibold tracking-tight";

/**
 * Lien de navigation des sidenavs (dashboard et admin) : la brique est
 * byte-identique entre les deux chromes, volontairement distincts par
 * ailleurs (TD-039) ; repli en rail → `aria-label`/`title` sur le lien.
 */
export function SidebarLink({ href, icon, label, active, collapsed }: SidebarLinkProps) {
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
          <Icon name={icon} className="text-[16px]" />
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
