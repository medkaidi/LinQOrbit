"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/icon";
import { filterOptions, type SelectOption } from "@/components/ui/select";

export type TagInputProps = {
  label: string;
  options: SelectOption[];
  /** Sélection courante (liste d'ids), contrôlée par l'appelant (RHF Controller). */
  value: string[];
  onValueChange: (next: string[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  id?: string;
  disabled?: boolean;
};

/**
 * Sélecteur multi-valeurs en chips avec typeahead (pattern LinkedIn / Greenhouse) :
 * on tape → suggestions filtrées → Entrée ou clic = ajoute la suggestion,
 * × (ou Backspace sur champ vide) = retire. Vocabulaires contrôlés : seule une
 * suggestion de la liste est ajoutable, jamais du texte libre.
 */
export function TagInput({
  label,
  options,
  value,
  onValueChange,
  onBlur,
  placeholder = "Type to search…",
  error,
  id,
  disabled = false,
}: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [query, setQuery] = useState("");

  /** Suggestions : vocabulaire moins la sélection déjà en place (pas de doublon). */
  const visibleOptions = useMemo(() => {
    const selected = new Set(value);
    return filterOptions(
      options.filter((option) => !selected.has(option.value)),
      query,
    );
  }, [options, value, query]);

  const labelsByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );

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

  const addOption = (option: SelectOption) => {
    if (!value.includes(option.value)) onValueChange([...value, option.value]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const removeValue = (removed: string) => {
    onValueChange(value.filter((entry) => entry !== removed));
    setHighlight(0);
    inputRef.current?.focus();
  };

  const moveHighlight = (delta: number) => {
    setHighlight((current) => {
      const last = Math.max(visibleOptions.length - 1, 0);
      return Math.min(Math.max(current + delta, 0), last);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const key = event.key;

    // Dans un formulaire, Enter doit toujours être intercepté (sinon soumission sauvage).
    if (key === "Enter") {
      event.preventDefault();
      if (!open) {
        openList(0);
        return;
      }
      const option = visibleOptions[highlight] ?? visibleOptions[0];
      if (option) addOption(option);
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
      if (!open) openList(0);
      else moveHighlight(1);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList(Math.max(visibleOptions.length - 1, 0));
      else moveHighlight(-1);
      return;
    }
    if (key === "Backspace" && query === "" && value.length > 0) {
      onValueChange(value.slice(0, -1));
      setHighlight(0);
    }
  };

  const handleInputChange = (next: string) => {
    setQuery(next);
    setHighlight(0);
    if (!open && next) openList(0);
  };

  const controlClasses = cn(
    "flex flex-wrap items-center gap-1.5 w-full min-h-11 rounded-lg px-2.5 py-1.5 transition-all",
    disabled && "opacity-50 cursor-not-allowed",
    error
      ? "bg-error-container ring-1 ring-error"
      : "bg-white border border-slate-border-strong focus-within:border-primary-container",
  );

  const listContent = visibleOptions.length === 0 ? (
    <li
      role="option"
      aria-disabled="true"
      aria-selected="false"
      className="mx-1 rounded-xl px-3.5 py-2 font-body-md text-body-md text-text-tertiary cursor-default"
    >
      No match
    </li>
  ) : (
    visibleOptions.map((option, index) => (
      <li
        key={option.value}
        id={`${listId}-opt-${index}`}
        role="option"
        data-index={index}
        aria-selected="false"
        onClick={() => addOption(option)}
        onMouseEnter={() => setHighlight(index)}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 font-body-md text-body-md text-text-primary",
          index === highlight ? "bg-surface-container-low font-semibold" : "",
        )}
      >
        <span className="truncate">{option.label}</span>
        {index === highlight ? <Icon name="add" className="shrink-0 text-[18px]" /> : null}
      </li>
    ))
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-label-md text-label-md text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <div
          className={controlClasses}
          onClick={() => {
            inputRef.current?.focus();
            if (!open) openList(0);
          }}
        >
          {value.map((entry) => {
            const optionLabel = labelsByValue.get(entry) ?? entry;
            return (
              <span
                key={entry}
                className="inline-flex items-center gap-1 rounded-full bg-orange-subtle border border-orange-border text-orange-deep pl-3 pr-1 py-1 text-xs font-semibold"
              >
                {optionLabel}
                <button
                  type="button"
                  aria-label={`Remove ${optionLabel}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeValue(entry);
                  }}
                  className="rounded-full p-0.5 hover:bg-orange-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep cursor-pointer disabled:cursor-not-allowed"
                >
                  <Icon name="close" className="text-[14px]! block" />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && visibleOptions.length > 0 ? `${listId}-opt-${highlight}` : undefined
            }
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={query}
            placeholder={value.length === 0 ? placeholder : "Add more…"}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => {
              if (!open) openList(0);
            }}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-32 h-8 px-1 bg-transparent text-body-md text-text-primary outline-none placeholder:text-text-tertiary cursor-text disabled:cursor-not-allowed"
          />
        </div>
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
            {listContent}
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
