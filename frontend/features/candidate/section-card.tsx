import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { SectionIcon } from "@/features/candidate/profile-shared";

export type SectionCardProps = {
  id: string;
  title: string;
  icon?: string;
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
  icon,
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
      <header className="mx-6 pt-4 pb-4 flex items-start justify-between gap-4 border-b border-slate-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? <SectionIcon name={icon} /> : null}
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0">
            {title}
          </h2>
        </div>
        <Badge tone={isComplete ? "success" : "neutral"}>
          {isComplete ? "Complete" : "Not started"}
        </Badge>
      </header>

      <div className="px-6 pt-5 pb-6">{children}</div>

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
          <CtaButton
            type="button"
            icon="save"
            busy={isSaving}
            onClick={onSave}
            disabled={!canSave}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </CtaButton>
        </div>
      </footer>
    </section>
  );
}
