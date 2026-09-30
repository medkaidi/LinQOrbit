import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";

export type AlertVariant = "info" | "success" | "error";

export type AlertProps = {
  variant?: AlertVariant;
  title: string;
  children: ReactNode;
  className?: string;
};

const variantClasses: Record<
  AlertVariant,
  { wrapper: string; iconWrap: string; label: string; icon: string }
> = {
  info: {
    wrapper: "bg-orange-subtle",
    iconWrap: "text-primary-container",
    label: "text-primary-container",
    icon: "info",
  },
  success: {
    wrapper: "bg-success-surface",
    iconWrap: "text-success-text",
    label: "text-success-text",
    icon: "check_circle",
  },
  error: {
    wrapper: "bg-error-container",
    iconWrap: "text-on-error-container",
    label: "text-on-error-container",
    icon: "error",
  },
};

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  const classes = variantClasses[variant];

  return (
    <div
      role="status"
      className={cn("mt-6 p-3 rounded-lg flex items-center gap-3", classes.wrapper, className)}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm",
          classes.iconWrap,
        )}
      >
        <Icon name={classes.icon} className="text-[17px]" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn("font-label-md text-label-md truncate", classes.label)}>{title}</span>
        <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
          {children}
        </span>
      </div>
    </div>
  );
}
