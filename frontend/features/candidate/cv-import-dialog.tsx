"use client";

import { useEffect, useState } from "react";

import { CvImportError, CvImportPreview } from "@/features/candidate/cv-import";
import type { CvImportPlan } from "@/features/candidate/cv-parsing";
import { applySkillMappings } from "@/features/candidate/cv-parsing";
import { useSuggestSkills } from "@/hooks/use-candidate-profile";
import type { ParsedCv, SkillReference } from "@/types/candidate";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/utils/api-error";

export type CvImportDialogStatus = "parsing" | "ready" | "error";

/**
 * Fenêtre d'import de CV : analyse en cours (fond et Échap bloqués), aperçu
 * avec mapping manuel des compétences hors catalogue, ou échec — Apply
 * renvoie le CV dont les noms mappés ont été canonisés.
 */
export function CvImportDialog({
  status,
  statusLabel = "Parsing in progress…",
  cv,
  plan,
  skillOptions,
  refsReady = true,
  errorMessage = null,
  onApply,
  onClose,
}: {
  status: CvImportDialogStatus;
  statusLabel?: string;
  cv: ParsedCv | null;
  plan: CvImportPlan | null;
  skillOptions: SkillReference[];
  refsReady?: boolean;
  errorMessage?: string | null;
  onApply: (cv: ParsedCv) => void;
  onClose: () => void;
}) {
  // Les mappings vivent avec leur CV : un nouveau CV retombe sur {} sans
  // reset explicite (état dérivé, pas d'effet).
  const [mappingState, setMappingState] = useState<{
    cv: ParsedCv;
    mappings: Record<string, string>;
  } | null>(null);
  const mappings = mappingState && mappingState.cv === cv ? mappingState.mappings : {};
  const mapSkill = (label: string, skillId: string) => {
    if (!cv) {
      return;
    }
    setMappingState({ cv, mappings: { ...mappings, [label]: skillId } });
  };

  // Confirmation d'envoi en revue : rattachée à son CV, remise à zéro au
  // prochain CV (même logique dérivée que les mappings).
  const [sentState, setSentState] = useState<{ cv: ParsedCv } | null>(null);
  const unresolvedSent = sentState !== null && sentState.cv === cv;
  const sendSuggestions = useSuggestSkills();
  const sendUnresolved = (names: string[]) => {
    if (!cv) {
      return;
    }
    sendSuggestions.mutate(names, {
      onSuccess: () => setSentState({ cv }),
    });
  };

  const locked = status !== "ready";

  // Fermeture par Échap, sauf pendant l'analyse (et sauf si un Select interne
  // a déjà traité la touche pour refermer sa liste).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !locked) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [locked, onClose]);

  // Le contenu de la page ne défile pas derrière la fenêtre.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={locked ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-text-primary/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="CV import"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-canvas-white rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {status === "parsing" ? (
          <div className="p-10 flex flex-col items-center gap-4">
            <Spinner className="text-[32px] text-orange-deep" />
            <p role="status" className="font-label-md text-label-md text-text-secondary">
              {statusLabel}
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="p-6 flex flex-col gap-4">
            <CvImportError message={errorMessage ?? "The CV could not be parsed."} />
            <footer className="flex justify-end">
              <Button variant="outline" type="button" onClick={onClose}>
                Close
              </Button>
            </footer>
          </div>
        ) : null}

        {status === "ready" && cv && plan ? (
          <CvImportPreview
            cv={cv}
            plan={plan}
            applyDisabled={!refsReady}
            applyHint={refsReady ? null : "Loading reference lists…"}
            skillOptions={skillOptions}
            mappings={mappings}
            onMappingChange={mapSkill}
            onSendUnresolved={sendUnresolved}
            sendingUnresolved={sendSuggestions.isPending}
            unresolvedSent={unresolvedSent}
            sendErrorMessage={
              sendSuggestions.isError ? getApiErrorMessage(sendSuggestions.error) : null
            }
            onApply={() => onApply(applySkillMappings(cv, mappings, skillOptions))}
            onDiscard={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
