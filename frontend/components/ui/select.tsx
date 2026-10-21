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

export type SelectOption = {
  value: string;
  label: string;
};

/** Filtre partagé (Select + TagInput) : label contenant la saisie, insensible à la casse. */
export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

type SelectProps = {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
  /**
   * Mode autocomplete : le déclencheur devient un champ texte qui filtre la liste
   * au fil de la frappe (listes longues : compétences, langues, pays…).
   */
  searchable?: boolean;
  /** Déclencheur compact (h-9, texte xs) aligné sur les contrôles segmentés. */
  compact?: boolean;
  /** Libellé à gauche du déclencheur, sur la même ligne, au lieu d'au-dessus. */
  inlineLabel?: boolean;
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
  searchable = false,
  compact = false,
  inlineLabel = false,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-list`;
  const errorId = `${triggerId}-error`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const bufferRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [query, setQuery] = useState("");

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /** Liste visible : filtrée en mode searchable, sinon la liste complète. */
  const visibleOptions = useMemo(() => {
    if (!searchable) return options;
    return filterOptions(options, query);
  }, [searchable, options, query]);

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

  const inputKey = open ? query : (selected?.label ?? "");

  const openList = (index: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setUpward(spaceBelow < 240 && rect.top >= 240);
    }
    if (searchable) setQuery("");
    setHighlight(index);
    setOpen(true);
  };

  const selectOption = (option: SelectOption) => {
    onValueChange?.(option.value);
    setOpen(false);
    if (searchable) inputRef.current?.focus();
    else triggerRef.current?.focus();
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

  const moveHighlight = (delta: number) => {
    setHighlight((current) => {
      const last = Math.max(visibleOptions.length - 1, 0);
      return Math.min(Math.max(current + delta, 0), last);
    });
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

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const key = event.key;
    const isTypingKey = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    // Dans un formulaire, Enter doit toujours être intercepté (sinon soumission sauvage).
    if (key === "Enter") {
      event.preventDefault();
      if (!open) {
        openList(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      const option = visibleOptions[highlight] ?? visibleOptions[0];
      if (option) selectOption(option);
      return;
    }

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        openList(0);
      } else if (isTypingKey) {
        // Saisie sur le champ fermé : la liste s'ouvre filtrée sur ce qui vient d'être tapé.
        event.preventDefault();
        openList(0);
        setQuery(key);
        setHighlight(0);
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
      moveHighlight(1);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      setHighlight(0);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      setHighlight(Math.max(visibleOptions.length - 1, 0));
      return;
    }
  };

  const handleInputChange = (next: string) => {
    setQuery(next);
    setHighlight(0);
  };

  const controlClasses = cn(
    compact
      ? "relative w-full h-9 rounded-full pl-3 pr-8 font-semibold text-xs transition-all focus:outline-none"
      : "relative w-full h-11 rounded-full pl-4 pr-10 font-body-md text-body-md transition-all focus:outline-none",
    disabled && "opacity-50 cursor-not-allowed",
    error
      ? "bg-error-container ring-1 ring-error"
      : "bg-white border border-slate-border-strong focus:border-primary-container",
  );

  const listItemClass = compact ? "text-xs" : "font-body-md text-body-md";

  const listContent = visibleOptions.length === 0 ? (
    <li
      role="option"
      aria-disabled="true"
      aria-selected="false"
      className={cn(
        "mx-1 rounded-xl px-3.5 py-2 text-text-tertiary cursor-default",
        listItemClass,
      )}
    >
      No match
    </li>
  ) : (
    visibleOptions.map((option, index) => {
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
            "mx-1 flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3.5 py-2",
            listItemClass,
            isSelected
              ? "bg-orange-subtle text-orange-deep font-semibold"
              : index === highlight
                ? "bg-surface-container-low text-text-primary"
                : "text-text-primary",
          )}
        >
          <span className="truncate">{option.label}</span>
          {isSelected ? (
            <Icon
              name="check"
              className={cn("shrink-0", compact ? "text-[14px]" : "text-[18px]")}
            />
          ) : null}
        </li>
      );
    })
  );

  return (
    <div
      ref={rootRef}
      className={cn("flex", inlineLabel ? "flex-row items-center gap-2" : "flex-col gap-1.5")}
    >
      <label
        htmlFor={triggerId}
        className={cn(
          inlineLabel && "shrink-0 whitespace-nowrap",
          compact
            ? "text-xs font-semibold text-text-secondary"
            : "font-label-md text-label-md text-text-secondary",
        )}
      >
        {label}
      </label>
      <div className={cn("relative", inlineLabel && "min-w-0 flex-1")}>
        {searchable ? (
          <input
            ref={inputRef}
            id={triggerId}
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
            value={inputKey}
            placeholder={placeholder}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => {
              if (!open) openList(selectedIndex >= 0 ? selectedIndex : 0);
            }}
            onClick={() => {
              if (!open) openList(selectedIndex >= 0 ? selectedIndex : 0);
            }}
            onBlur={onBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              controlClasses,
              "cursor-text text-text-primary placeholder:text-text-tertiary",
            )}
          />
        ) : (
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
              controlClasses,
              "flex items-center text-left cursor-pointer",
              selected ? "text-text-primary" : "text-text-tertiary",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {selected ? selected.label : placeholder}
            </span>
          </button>
        )}
        <Icon
          name="expand_more"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none transition-transform",
            compact ? "right-2.5 text-[16px]" : "right-4 text-[20px]",
            open && "rotate-180",
          )}
        />
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
