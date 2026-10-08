"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { RetryButton } from "@/features/admin/retry-button";
import { useApproveSkillSuggestion, useLinkSkillSuggestion } from "@/hooks/use-admin";
import { useReferenceSkills } from "@/hooks/use-candidate-profile";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AdminSkillSuggestion } from "@/types/admin";

type ReviewMode = "new" | "existing";
type SkillKind = "tech" | "soft";

/**
 * Revue d'une suggestion de compétence, en deux modes : création au catalogue
 * (catégorie existante + type tech/soft) ou lien vers une compétence déjà
 * existante. Le rejet vit sur la ligne de la section, pas ici.
 */
export function SuggestionReviewDialog({
  suggestion,
  onClose,
}: {
  suggestion: AdminSkillSuggestion;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ReviewMode>("new");
  const [category, setCategory] = useState("");
  const [skillKind, setSkillKind] = useState<SkillKind>("tech");
  const [skillId, setSkillId] = useState("");

  const reference = useReferenceSkills();
  const approve = useApproveSkillSuggestion();
  const link = useLinkSkillSuggestion();
  const pending = approve.isPending || link.isPending;

  const categoryOptions = useMemo(() => {
    const categories = [...new Set((reference.data ?? []).map((skill) => skill.category))];
    return categories.sort().map((value) => ({ value, label: value }));
  }, [reference.data]);

  const skillOptions = useMemo(
    () =>
      (reference.data ?? []).map((skill) => ({
        value: skill.id,
        label: `${skill.name} — ${skill.category}`,
      })),
    [reference.data],
  );

  // Fermeture par Échap (un Select interne peut avoir traité la touche avant).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !pending) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, onClose]);

  // Le contenu de la page ne défile pas derrière la fenêtre.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const error = approve.isError
    ? getApiErrorMessage(approve.error)
    : link.isError
      ? getApiErrorMessage(link.error)
      : null;
  const dismissError = () => {
    approve.reset();
    link.reset();
  };

  const confirmDisabled =
    pending || reference.isLoading || (mode === "new" ? category === "" : skillId === "");

  const confirm = () => {
    if (mode === "new") {
      approve.mutate(
        { id: suggestion.id, category, skillType: skillKind },
        { onSuccess: onClose },
      );
    } else {
      link.mutate({ id: suggestion.id, skillId }, { onSuccess: onClose });
    }
  };

  const author = [suggestion.candidateFirstName, suggestion.candidateLastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={pending ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-text-primary/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Review suggestion ${suggestion.name}`}
        className="relative w-full max-w-xl bg-canvas-white rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mx-6 pt-4 pb-4 border-b border-slate-border">
          <h2 className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
            Review skill suggestion
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-text-secondary truncate">
            “{suggestion.name}” suggested by {author || "Unknown candidate"}
          </p>
        </header>

        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
          {error && (
            <Alert variant="error" title="Unable to review the suggestion">
              {error} <RetryButton onRetry={dismissError} label="Dismiss" />
            </Alert>
          )}

          <SegmentedControl
            label="Resolution"
            value={mode}
            options={[
              { value: "new", label: "New skill" },
              { value: "existing", label: "Existing skill" },
            ]}
            onChange={setMode}
            className="self-center"
          />

          {mode === "new" ? (
            <>
              <Select
                label="Category"
                options={categoryOptions}
                placeholder="Pick an existing category"
                value={category}
                onValueChange={setCategory}
                disabled={reference.isLoading}
              />
              <div className="flex items-center justify-between gap-4">
                <span className="font-label-md text-label-md text-text-secondary">Skill type</span>
                <SegmentedControl
                  label="Skill type"
                  value={skillKind}
                  options={[
                    { value: "tech", label: "Technical" },
                    { value: "soft", label: "Soft" },
                  ]}
                  onChange={setSkillKind}
                />
              </div>
            </>
          ) : (
            <Select
              label="Catalog skill"
              searchable
              options={skillOptions}
              placeholder="Search an existing skill"
              value={skillId}
              onValueChange={setSkillId}
              disabled={reference.isLoading}
            />
          )}
        </div>

        <footer className="mx-6 pt-4 pb-5 flex items-center justify-between gap-3 border-t border-slate-border">
          <Button variant="outline-sm" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <CtaButton
            icon={mode === "new" ? "check" : "link"}
            type="button"
            busy={pending}
            disabled={confirmDisabled}
            onClick={confirm}
          >
            {mode === "new" ? "Approve" : "Link to profile"}
          </CtaButton>
        </footer>
      </div>
    </div>
  );
}
