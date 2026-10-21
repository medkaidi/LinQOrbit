"use client";

import { useId, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MUTED_TEXT_CLASS } from "@/components/ui/section";
import { TextField } from "@/components/ui/text-field";

/** Éditeur de score d'un critère : saisie numérique, pas-à-pas et curseur, tous synchronisés. */
export function ScoreEditor({
  label,
  aiScore,
  value,
  name,
  error,
  onChange,
  onBlur,
  onRemove,
  disabled = false,
  inputRef,
}: {
  label: string;
  aiScore: number;
  value: string;
  name: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Retire le score, ou annule l'éditeur vide, et referme. */
  onRemove: () => void;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const sliderId = useId();
  const numeric = value === "" ? null : Number(value);
  const hasValue = value !== "";
  const sliderValue = numeric !== null && Number.isFinite(numeric) ? clampScore(numeric) : aiScore;

  const stepBy = (delta: number) => {
    const base = numeric !== null && Number.isFinite(numeric) ? clampScore(numeric) : aiScore;
    onChange(String(clampScore(base + delta)));
  };

  return (
    <div className="rounded-2xl border border-slate-border bg-canvas-white p-3.5 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-start">
        <TextField
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          label="Your score"
          aria-label={`Your score for ${label}`}
          placeholder="0–100"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          error={error}
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={sliderId} className="font-label-md text-label-md text-text-secondary">
            Adjust with the slider
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderValue}
            aria-label={`Adjust your score for ${label}`}
            aria-valuetext={hasValue ? `${sliderValue} out of 100` : `Not set; AI score ${aiScore} out of 100`}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="h-6 w-full cursor-pointer accent-primary-container disabled:cursor-not-allowed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="icon-sm"
              type="button"
              aria-label={`Decrease your score for ${label}`}
              disabled={disabled}
              onClick={() => stepBy(-1)}
            >
              <Icon name="remove" className="text-[16px]" />
            </Button>
            <Button
              variant="icon-sm"
              type="button"
              aria-label={`Increase your score for ${label}`}
              disabled={disabled}
              onClick={() => stepBy(1)}
            >
              <Icon name="add" className="text-[16px]" />
            </Button>
            <Button
              variant="outline-sm"
              type="button"
              aria-label={
                hasValue ? `Clear your score for ${label}` : `Cancel editing your score for ${label}`
              }
              disabled={disabled}
              onClick={onRemove}
            >
              {hasValue ? "Clear score" : "Cancel"}
            </Button>
            <span className={`${MUTED_TEXT_CLASS} ml-auto`}>{hasValue ? `${sliderValue} / 100` : "Not set"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}
