import type { ReactNode } from "react";

/**
 * Bloc de section numéroté (« 1. Education », …) façon fiche technique :
 * pastille numérotée façon `ItemIndex` (fond blanc, bordure grise, chiffre
 * `blue-deep`), titre nu, meta mono facultative, filet de séparation.
 * L'index est fixe par section (elle ne se réordonne pas quand une section est vide).
 */
export function SectionBlock({
  index,
  title,
  meta,
  children,
}: {
  index: number;
  title: string;
  meta?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-3 mb-4 border-b border-slate-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-full bg-canvas-white border border-slate-border text-blue-deep flex items-center justify-center text-[12px] font-semibold shrink-0"
          >
            {index}
          </span>
          <h3 className="font-headline-md text-headline-md text-text-primary tracking-tight">
            {title}
          </h3>
        </div>
        {meta && (
          <span className="font-mono text-[11px] text-text-tertiary shrink-0">{meta}</span>
        )}
      </header>
      {children}
    </section>
  );
}
