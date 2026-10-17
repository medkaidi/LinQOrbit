import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";

type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "className" | "type"> & {
  label: ReactNode;
  checked: boolean;
};

export function Checkbox({ label, checked, ...inputProps }: CheckboxProps) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
      <input type="checkbox" className="sr-only peer" checked={checked} {...inputProps} />
      <span
        className={cn(
          "w-5 h-5 rounded-md flex items-center justify-center transition-colors",
          checked ? "bg-primary-container" : "bg-surface-container-low",
        )}
      >
        <Icon
          name="check"
          className={cn(
            "text-white text-[15px] font-bold transition-transform",
            checked ? "scale-100" : "scale-0",
          )}
        />
      </span>
      <span className="font-body-md text-body-md text-text-secondary">{label}</span>
    </label>
  );
}
