import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "outline" | "ghost" | "cta";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "group relative overflow-hidden w-full h-12 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
  outline:
    "group flex items-center justify-center gap-2 h-11 px-3 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer",
  ghost:
    "group flex items-center justify-center gap-2 h-12 px-3 rounded-full text-body-md font-body-md text-text-secondary hover:text-text-primary hover:bg-canvas-subtle transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
  // CTA standard de la plateforme (même style que le bouton « New Job » du dashboard) :
  // pill orange, badge circulaire qui s'inverse au survol. Sans w-full ni h-* pour ne pas
  // entrer en conflit avec un className appelant (cn() est un simple join).
  cta: "group inline-flex items-center gap-2 py-1 px-2.5 rounded-full text-orange-deep hover:text-canvas-white hover:bg-primary-container font-bold text-xs transition-[background-color,color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(variantClasses[variant], className)} {...props} />;
}
