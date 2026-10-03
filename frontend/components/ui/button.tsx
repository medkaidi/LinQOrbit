import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "outline";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "group relative overflow-hidden w-full h-12 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
  outline:
    "group flex items-center justify-center gap-2 h-11 px-3 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(variantClasses[variant], className)} {...props} />;
}
