import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeProps = {
  children: ReactNode;
  className?: string;
};

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "font-label-caps text-label-caps uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}
