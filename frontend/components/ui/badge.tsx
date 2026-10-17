import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "success";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-secondary-fixed text-on-secondary-fixed",
  success: "bg-success-surface text-success-text",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "font-label-caps text-label-caps normal-case tracking-normal px-2.5 py-1 rounded-full font-bold shrink-0",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
