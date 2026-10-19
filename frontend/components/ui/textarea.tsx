import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type TextareaProps = Omit<ComponentPropsWithRef<"textarea">, "className"> & {
  label: string;
  /** Contenu aligné à droite sur la ligne de label (compteur de caractères…). */
  labelAction?: ReactNode;
  /** Masque visuellement le label (titre porté ailleurs, ex. carte de question) — il reste lu par les lecteurs d'écran. */
  hideLabel?: boolean;
  error?: string;
};

export function Textarea({ label, labelAction, hideLabel = false, error, id, ...textareaProps }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel || labelAction ? (
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={textareaId}
            className={cn("font-label-md text-label-md text-text-secondary", hideLabel && "sr-only")}
          >
            {label}
          </label>
          {labelAction}
        </div>
      ) : (
        <label htmlFor={textareaId} className="sr-only">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full min-h-32 rounded-2xl px-4 py-3 font-body-md text-body-md text-text-primary placeholder:text-text-tertiary focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out resize-y",
          error
            ? "bg-error-container focus:bg-error-container ring-1 ring-error"
            : "bg-white border border-slate-border-strong focus:border-primary-container",
        )}
        {...textareaProps}
      />
      {error ? (
        <p id={errorId} className="font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
