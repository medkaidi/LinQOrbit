import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type SectionCardProps = {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isDirty: boolean;
  isSaving: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  children: ReactNode;
};

/**
 * Carte d'une section du profil : en-tête avec l'état de complétion, corps de
 * section, puis pied de page avec le retour de la sauvegarde. Chaque section se
 * sauvegarde indépendamment des autres.
 */
export function SectionCard({
  id,
  title,
  description,
  isComplete,
  isDirty,
  isSaving,
  errorMessage,
  successMessage,
  onSave,
  onDiscard,
  children,
}: SectionCardProps) {
  const canSave = isDirty && !isSaving;

  return (
    <section id={id} className="bg-canvas-white rounded-2xl shadow-sm scroll-mt-24">
      <header className="p-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary">{description}</p>
        </div>
        <Badge tone={isComplete ? "success" : "neutral"}>
          {isComplete ? "Complete" : "Not started"}
        </Badge>
      </header>

      <div className="px-6 pb-6">{children}</div>

      <footer className="px-6 py-4 border-t border-slate-border flex flex-col gap-3">
        {errorMessage ? (
          <Alert variant="error" title="Could not save this section" className="mt-0">
            {errorMessage}
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert variant="success" title="Section saved" className="mt-0">
            {successMessage}
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={onDiscard}
            disabled={!isDirty || isSaving}
          >
            Discard
          </Button>
          <Button variant="cta" type="button" onClick={onSave} disabled={!canSave}>
            <span className="w-6 h-6 rounded-full bg-primary-container group-hover:bg-canvas-white text-canvas-white group-hover:text-primary-container flex items-center justify-center shrink-0 transition-colors duration-200">
              <Icon
                name={isSaving ? "refresh" : "save"}
                className={cn("text-[16px]", isSaving && "animate-spin")}
              />
            </span>
            <span className="leading-none transition-colors duration-200">
              {isSaving ? "Saving…" : "Save changes"}
            </span>
          </Button>
        </div>
      </footer>
    </section>
  );
}
