"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
};

export function Select({
  label,
  options,
  placeholder,
  error,
  value,
  onValueChange,
  onBlur,
  id,
  disabled,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-list`;
  const errorId = `${triggerId}-error`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const bufferRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback(() => {
    setOpen(false);
    onBlur?.();
  }, [onBlur]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlight]);

  const openList = (index: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setUpward(spaceBelow < 240 && rect.top >= 240);
    }
    setHighlight(index);
    setOpen(true);
  };

  const selectOption = (option: SelectOption) => {
    onValueChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const matchPrefix = (prefix: string, from: number) => {
    const needle = prefix.toLowerCase();
    for (let step = 0; step < options.length; step += 1) {
      const index = (from + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(needle)) return index;
    }
    return -1;
  };

  const pushTypeahead = (char: string) => {
    bufferRef.current += char.toLowerCase();
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      bufferRef.current = "";
    }, 600);
    const from = open ? (bufferRef.current.length > 1 ? highlight : highlight + 1) : 0;
    const index = matchPrefix(bufferRef.current, from);
    if (index < 0) return;
    if (!open) openList(index);
    else setHighlight(index);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const key = event.key;
    const isTypingKey = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!open) {
      if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        openList(key === "ArrowUp" ? options.length - 1 : selectedIndex >= 0 ? selectedIndex : 0);
      } else if (isTypingKey) {
        event.preventDefault();
        pushTypeahead(key);
      }
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (key === "Tab") {
      close();
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, options.length - 1));
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      setHighlight(0);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      setHighlight(options.length - 1);
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      const option = options[highlight];
      if (option) selectOption(option);
      return;
    }
    if (isTypingKey) {
      event.preventDefault();
      pushTypeahead(key);
    }
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <label htmlFor={triggerId} className="font-label-md text-label-md text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-opt-${highlight}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onClick={() => (open ? close() : openList(selectedIndex >= 0 ? selectedIndex : 0))}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className={cn(
            "relative flex w-full h-11 items-center rounded-full pl-4 pr-10 text-left font-body-md text-body-md transition-all focus:outline-none cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            error
              ? "bg-error-container ring-1 ring-error"
              : "bg-white border border-slate-border-strong focus:border-primary-container",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selected ? "text-text-primary" : "text-text-tertiary",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <Icon
            name="expand_more"
            className={cn(
              "absolute right-4 text-[20px] text-text-tertiary pointer-events-none transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className={cn(
              "absolute z-50 w-full max-h-60 overflow-y-auto rounded-2xl bg-white border border-slate-border-strong shadow-md py-1.5",
              upward ? "bottom-full mb-1.5" : "top-full mt-1.5",
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  data-index={index}
                  aria-selected={isSelected}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    "mx-1 flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3.5 py-2 font-body-md text-body-md",
                    isSelected
                      ? "bg-orange-subtle text-orange-deep font-semibold"
                      : index === highlight
                        ? "bg-surface-container-low text-text-primary"
                        : "text-text-primary",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <Icon name="check" className="shrink-0 text-[18px]" /> : null}
                </li>
              );
            })}
          </ul>
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
