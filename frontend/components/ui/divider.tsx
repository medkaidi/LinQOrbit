import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type DividerProps = {
  children: ReactNode;
  className?: string;
};

export function Divider({ children, className }: DividerProps) {
  return (
    <div className={cn("relative flex items-center justify-center my-2 mb-6", className)}>
      <div className="w-full h-px bg-surface-container-high" />
      <span className="absolute bg-surface-container-lowest px-3 font-label-md text-label-md text-text-tertiary">
        {children}
      </span>
    </div>
  );
}
