"use client";

import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
    <Dialog
      title="Review skill suggestion"
      description={
        <>
          &ldquo;{suggestion.name}&rdquo; suggested by {author || "Unknown candidate"}
        </>
      }
      ariaLabel={`Review suggestion ${suggestion.name}`}
      dismissable={!pending}
      onClose={onClose}
      footer={
        <>
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
        </>
      }
    >
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
    </Dialog>
  );
}
