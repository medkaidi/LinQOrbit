"use client";

import { cn } from "@/lib/utils/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange?: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex items-center border border-slate-border rounded-full p-1 bg-canvas-subtle",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={Boolean(option.disabled)}
            aria-pressed={active}
            onClick={() => onChange?.(option.value)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep",
              active
                ? "border-orange-border bg-orange-subtle text-orange-deep"
                : "border-transparent text-text-secondary",
              option.disabled
                ? "cursor-not-allowed"
                : "cursor-pointer hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
