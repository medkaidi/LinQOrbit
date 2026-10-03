import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";

export type TextFieldProps = Omit<ComponentPropsWithRef<"input">, "className"> & {
  label: string;
  /** Contenu aligné à droite sur la ligne de label (indice, lien « forgot password »…). */
  labelAction?: ReactNode;
  icon?: string;
  error?: string;
  trailing?: ReactNode;
};

export function TextField({
  label,
  labelAction,
  icon,
  error,
  trailing,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="font-label-md text-label-md text-text-secondary">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative flex items-center">
        {icon ? (
          <Icon
            name={icon}
            className="absolute left-4 text-text-tertiary pointer-events-none text-[20px]"
          />
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full h-11 rounded-full font-body-md text-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out",
            icon ? "pl-11" : "pl-4",
            trailing ? "pr-11" : "pr-4",
            error
              ? "bg-error-container focus:bg-error-container ring-1 ring-error"
              : "bg-white border border-slate-border-strong focus:border-primary-container",
          )}
          {...inputProps}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-3 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
