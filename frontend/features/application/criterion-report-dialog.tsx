"use client";

import { useState } from "react";

import { Button, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITERION_REASON_OPTIONS,
  CRITERION_REASON_PLACEHOLDERS,
  criterionReasonRequiresComment,
} from "@/features/application/recruiter-application-shared";
import type { CriterionReportRequest } from "@/lib/api/application.api";
import type { CriterionReportReason, RecruiterCriterionView } from "@/types/application";

const COMMENT_MAX_LENGTH = 2000;

type CriterionReportDialogProps = {
  /** Critère signalé — la clé est recopiée telle quelle, jamais recalculée. */
  criterion: RecruiterCriterionView;
  busy: boolean;
  error: string | null;
  onSubmit: (body: CriterionReportRequest) => void;
  onClose: () => void;
};

/**
 * Signalement interne d'une évaluation IA par critère (D66) : un retour
 * qualité sur l'évaluation affichée. Le score n'est pas modifié, le candidat
 * ne voit rien, et **le signalement est définitif** — d'où l'annonce explicite
 * et l'absence de toute édition.
 *
 * Le commentaire est facultatif, sauf pour le motif « other » : seul lui ne
 * dit rien par lui-même, le serveur l'exige dans ce cas.
 */
export function CriterionReportDialog({
  criterion,
  busy,
  error,
  onSubmit,
  onClose,
}: CriterionReportDialogProps) {
  const [reason, setReason] = useState<CriterionReportReason | "">("");
  const [comment, setComment] = useState("");

  const commentRequired = reason !== "" && criterionReasonRequiresComment(reason);
  const trimmed = comment.trim();
  const commentMissing = commentRequired && trimmed.length === 0;
  const canSubmit = reason !== "" && !commentMissing && trimmed.length <= COMMENT_MAX_LENGTH;

  return (
    <Dialog
      title="Report this assessment"
      description={criterion.label}
      dismissable={!busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline-sm" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <CtaButton
            type="button"
            tone="secondary"
            icon="send"
            busy={busy}
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) {
                return;
              }
              onSubmit({
                criterionKey: criterion.key,
                reason: reason as CriterionReportReason,
                comment: trimmed.length > 0 ? trimmed : null,
              });
            }}
          >
            Send report
          </CtaButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body-sm font-body-sm text-text-secondary leading-relaxed">
          Internal feedback on the AI assessment of this criterion. The score is not changed, the
          candidate never sees it, and no re-evaluation is triggered.
        </p>

        <Select
          label="Reason"
          options={CRITERION_REASON_OPTIONS}
          placeholder="Choose a reason"
          value={reason === "" ? undefined : reason}
          onValueChange={(value) => setReason(value as CriterionReportReason)}
        />

        <Textarea
          label={commentRequired ? "Comment (required)" : "Comment (optional)"}
          labelAction={
            <span className="text-body-sm font-body-sm text-text-tertiary tabular-nums">
              {comment.length}/{COMMENT_MAX_LENGTH}
            </span>
          }
          placeholder={reason === "" ? "" : CRITERION_REASON_PLACEHOLDERS[reason]}
          value={comment}
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          error={
            commentMissing
              ? "A comment is required when the reason is other."
              : trimmed.length > COMMENT_MAX_LENGTH
                ? `The comment must not exceed ${COMMENT_MAX_LENGTH} characters.`
                : undefined
          }
        />

        <div className="flex items-start gap-2 rounded-2xl border border-slate-border bg-item-surface/60 px-4 py-3">
          <Icon name="info" className="mt-px text-[16px] text-text-tertiary" />
          <p className="text-body-sm font-body-sm text-text-secondary">
            This report is final: it cannot be edited or withdrawn, and it is only visible to you
            and the internal team.
          </p>
        </div>

        {error ? (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
