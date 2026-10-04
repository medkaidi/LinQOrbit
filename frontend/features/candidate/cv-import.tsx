"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import type { CvImportPlan } from "@/features/candidate/cv-parsing";
import { SectionIcon } from "@/features/candidate/profile-shared";
import type { ParsedCv } from "@/lib/api/candidate.api";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const UPLOAD_BUTTON_CLASSES =
  "flex items-center gap-2 px-4 py-2 rounded-full bg-orange-subtle border border-primary-fixed-dim text-orange-deep font-bold text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";

/** Bouton « Upload CV » du header : ouvre le sélecteur de fichier PDF. */
export function CvUploadButton({
  isParsing,
  onSelect,
}: {
  isParsing: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={isParsing}
        aria-busy={isParsing}
        onClick={() => inputRef.current?.click()}
        className={UPLOAD_BUTTON_CLASSES}
      >
        <Icon name="upload_file" className="text-[16px]" />
        {isParsing ? "Analyzing…" : "Upload CV"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Re-arm the input so the same file can be picked again after a failure.
          event.target.value = "";
          if (file) {
            onSelect(file);
          }
        }}
      />
    </>
  );
}

/** Échec de l'analyse : message du backend (ProblemDetail) en role="alert". */
export function CvImportError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg bg-error-container p-3 flex items-center gap-3"
    >
      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-on-error-container">
        <Icon name="error" className="text-[17px]" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-label-md text-label-md text-on-error-container truncate">
          This CV could not be read
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{message}</span>
      </div>
    </div>
  );
}

const toMonthLabel = (month: string | null): string | null => {
  if (!month) {
    return null;
  }
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return null;
  }
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en", {
    month: "short",
    year: "numeric",
  });
};

const periodLabel = (start: string, end: string | null): string => {
  const startLabel = toMonthLabel(start) ?? start;
  const endLabel = end ? (toMonthLabel(end) ?? end) : "Present";
  return `${startLabel} — ${endLabel}`;
};

function PreviewList({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-border bg-item-surface/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
          {title}
        </span>
        <span className="font-body-sm text-body-sm text-text-secondary">{count} found</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

const emptyListLabel = <p className="text-body-sm font-body-sm text-text-tertiary">Nothing found</p>;

/**
 * Aperçu de l'import : montre ce que le CV contient et ce qui sera écarté,
 * avant tout remplissage du formulaire (Apply) ou abandon (Discard).
 */
export function CvImportPreview({
  cv,
  plan,
  applyDisabled = false,
  applyHint = null,
  onApply,
  onDiscard,
}: {
  cv: ParsedCv;
  plan: CvImportPlan;
  applyDisabled?: boolean;
  applyHint?: string | null;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <section
      aria-label="CV import preview"
      className="bg-canvas-white rounded-2xl p-6 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-start gap-3">
        <SectionIcon name="upload_file" />
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Review your CV import
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
            Nothing is saved yet. Applying fills your sections — check each one and save as usual.
          </p>
        </div>
      </header>

      {cv.title || cv.summary ? (
        <div className="rounded-2xl border border-slate-border bg-item-surface/50 p-4">
          <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
            About
          </span>
          {cv.title ? (
            <p className="mt-2 font-label-md text-label-md text-text-primary">{cv.title}</p>
          ) : null}
          {cv.summary ? (
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary">{cv.summary}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PreviewList title="Experiences" count={cv.experiences.length}>
          {cv.experiences.length === 0
            ? emptyListLabel
            : cv.experiences.map((experience, index) => (
                <div key={`${experience.companyName}-${index}`}>
                  <p className="text-body-sm font-body-sm text-text-primary">
                    {experience.positionTitle} · {experience.companyName}
                  </p>
                  <p className="text-body-sm font-body-sm text-text-tertiary">
                    {periodLabel(experience.startDate, experience.endDate)}
                  </p>
                </div>
              ))}
        </PreviewList>

        <PreviewList title="Education" count={cv.diplomas.length}>
          {cv.diplomas.length === 0
            ? emptyListLabel
            : cv.diplomas.map((diploma, index) => (
                <div key={`${diploma.institution}-${index}`}>
                  <p className="text-body-sm font-body-sm text-text-primary">{diploma.title}</p>
                  <p className="text-body-sm font-body-sm text-text-tertiary">
                    {diploma.institution} · {periodLabel(diploma.startDate, diploma.endDate)}
                  </p>
                </div>
              ))}
        </PreviewList>

        <PreviewList title="Skills" count={cv.skills.length}>
          {cv.skills.length === 0
            ? emptyListLabel
            : cv.skills.map((skill) => (
                <p key={skill.name} className="text-body-sm font-body-sm text-text-primary">
                  {skill.name}
                  {skill.level != null ? ` · Level ${skill.level}` : ""}
                  {skill.yearsExperience != null ? ` · ${skill.yearsExperience} yrs` : ""}
                </p>
              ))}
        </PreviewList>

        <PreviewList title="Languages" count={cv.languages.length}>
          {cv.languages.length === 0
            ? emptyListLabel
            : cv.languages.map((language) => (
                <p key={language.name} className="text-body-sm font-body-sm text-text-primary">
                  {language.name}
                  {language.level ? ` · ${language.level}` : ""}
                </p>
              ))}
        </PreviewList>
      </div>

      {cv.links.length > 0 ? (
        <PreviewList title="Links" count={cv.links.length}>
          {cv.links.map((link) => (
            <p key={link.url} className="text-body-sm font-body-sm text-text-primary">
              {link.label}
              <span className="text-text-tertiary"> · {link.url}</span>
            </p>
          ))}
        </PreviewList>
      ) : null}

      {plan.skipped.length > 0 ? (
        <div className="rounded-lg bg-orange-subtle p-3 flex flex-col gap-1">
          <span className="font-label-md text-label-md text-primary-container">
            Skipped from this import
          </span>
          <ul className="flex flex-col gap-0.5">
            {plan.skipped.map((skip) => (
              <li key={`${skip.label}-${skip.reason}`} className="text-body-sm font-body-sm text-on-surface-variant">
                {skip.label} — {skip.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-end gap-3">
        {applyHint ? (
          <span className="mr-auto text-body-sm font-body-sm text-text-secondary">{applyHint}</span>
        ) : null}
        <Button variant="outline" type="button" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="cta" type="button" onClick={onApply} disabled={applyDisabled}>
          Apply to my profile
        </Button>
      </footer>
    </section>
  );
}
