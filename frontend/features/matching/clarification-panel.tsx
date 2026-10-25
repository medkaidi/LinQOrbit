"use client";

import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { useAnswerClarification, useFinishAssessment, useSkipClarification } from "@/hooks/use-matching";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { CLARIFICATION_ANSWER_MAX } from "@/lib/validations/matching.schemas";
import type { Matching, MatchingClarification } from "@/types/matching";

/** `remainingQuestions` compte les questions possibles **après** celle-ci — un plafond, pas une promesse. */
function remainingLabel(remaining: number): string {
  if (remaining <= 0) {
    return "Last question";
  }
  return `Up to ${remaining} more ${remaining === 1 ? "question" : "questions"}`;
}

function ClarificationQuestion({
  publicId,
  clarification,
}: {
  publicId: string;
  clarification: MatchingClarification;
}) {
  const answer = useAnswerClarification(publicId);
  const skip = useSkipClarification(publicId);
  const finish = useFinishAssessment(publicId);
  const [text, setText] = useState("");
  const [emptyError, setEmptyError] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  // Une opération à la fois : répondre, passer et clore s'excluent.
  const busy = answer.isPending || skip.isPending || finish.isPending;

  // Un seul message d'échec visible : celui du dernier geste.
  const resetErrors = () => {
    answer.reset();
    skip.reset();
    finish.reset();
  };

  const handleAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (value === "") {
      setEmptyError(true);
      return;
    }
    resetErrors();
    answer.mutate({ clarificationId: clarification.id, answer: value });
  };

  const handleSkip = () => {
    setEmptyError(false);
    resetErrors();
    skip.mutate(clarification.id);
  };

  return (
    <section aria-label="Dynamic Candidate Assessment" className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBadge icon="psychology" />
          <h2 className={SECTION_TITLE_CLASS}>Dynamic Candidate Assessment</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge tone="accent">Question {clarification.questionNumber}</Badge>
          <Badge tone="outline">{remainingLabel(clarification.remainingQuestions)}</Badge>
        </div>
      </header>

      <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
        <div className="rounded-2xl border border-orange-border bg-orange-subtle/60 p-5 flex flex-col gap-2">
          <p className="font-label-caps text-label-caps uppercase tracking-wider text-orange-deep">
            Question from the AI
          </p>
          <p className="text-body-lg font-body-lg font-semibold text-text-primary leading-snug break-words">
            {clarification.question}
          </p>
        </div>

        {clarification.rationale ? (
          <div className="rounded-2xl border border-blue-border bg-blue-surface/60 p-4 flex items-start gap-3">
            <Icon name="info" className="text-blue-deep text-[20px] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-label-caps text-label-caps uppercase tracking-wider text-blue-deep">
                Why this question
              </p>
              <p className={`${MUTED_TEXT_CLASS} break-words mt-1`}>{clarification.rationale}</p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleAnswer} noValidate className="flex flex-col gap-3">
          <Textarea
            label="Your answer"
            aria-required
            maxLength={CLARIFICATION_ANSWER_MAX}
            readOnly={busy}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setEmptyError(false);
            }}
            error={emptyError ? "Write an answer, or pass this question." : undefined}
            labelAction={
              <span className={MUTED_TEXT_CLASS}>
                {text.length} / {CLARIFICATION_ANSWER_MAX}
              </span>
            }
          />
          <p className={MUTED_TEXT_CLASS}>
            Passing a question skips it but still counts toward the AI question limit.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CtaButton type="submit" icon="send" busy={answer.isPending} disabled={busy}>
              Send answer
            </CtaButton>
            <Button variant="outline-sm" type="button" busy={skip.isPending} disabled={busy} onClick={handleSkip}>
              Pass this question
            </Button>
            <Button
              variant="outline-sm"
              type="button"
              disabled={busy}
              onClick={() => {
                setEmptyError(false);
                resetErrors();
                setConfirmFinish(true);
              }}
            >
              Finish the assessment
            </Button>
          </div>
        </form>

        {answer.error ? (
          <Alert variant="error" title="Could not send your answer">
            {getApiErrorMessage(answer.error)}
          </Alert>
        ) : null}
        {skip.error ? (
          <Alert variant="error" title="Could not pass this question">
            {getApiErrorMessage(skip.error)}
          </Alert>
        ) : null}
        {finish.error ? (
          <Alert variant="error" title="Could not finish the assessment">
            {getApiErrorMessage(finish.error)}
          </Alert>
        ) : null}

        {confirmFinish ? (
          <FinishAssessmentDialog
            busy={finish.isPending}
            onCancel={() => setConfirmFinish(false)}
            onConfirm={() => finish.mutate(undefined, { onSettled: () => setConfirmFinish(false) })}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Confirmation de clôture — irréversible : plus aucune question ensuite. */
function FinishAssessmentDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      title="Finish the assessment?"
      message="No more questions will be asked and your current scores become final. You can then give your own view on each criterion before applying."
      confirmLabel="Finish"
      tone="danger"
      icon="flag"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Analyse terminée sans question ouverte ni évaluation close : n'arrive que
 * pour un matching analysé avant T-62 (le backend écrit sinon la question
 * suivante ou la clôture dans la même transaction). Rien n'est attendu — le
 * candidat peut clore pour accéder à sa revue.
 */
function NoOpenQuestion({ publicId }: { publicId: string }) {
  const finish = useFinishAssessment(publicId);
  const [confirmFinish, setConfirmFinish] = useState(false);

  return (
    <section aria-label="Dynamic Candidate Assessment" className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBadge icon="psychology" />
          <h2 className={SECTION_TITLE_CLASS}>Dynamic Candidate Assessment</h2>
        </div>
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-3">
        <p className={MUTED_TEXT_CLASS}>No AI question is waiting for you.</p>
        <Button
          variant="outline-sm"
          type="button"
          disabled={finish.isPending}
          onClick={() => {
            finish.reset();
            setConfirmFinish(true);
          }}
        >
          Finish the assessment
        </Button>
        {finish.error ? (
          <Alert variant="error" title="Could not finish the assessment">
            {getApiErrorMessage(finish.error)}
          </Alert>
        ) : null}
        {confirmFinish ? (
          <FinishAssessmentDialog
            busy={finish.isPending}
            onCancel={() => setConfirmFinish(false)}
            onConfirm={() => finish.mutate(undefined, { onSettled: () => setConfirmFinish(false) })}
          />
        ) : null}
      </div>
    </section>
  );
}

/**
 * Clarifications IA d'un matching terminé (T-62) : la question ouverte et la
 * raison pour laquelle elle est posée, le rang et le plafond restant, puis
 * Answer / Pass / Finish (confirmé — l'évaluation se clôt pour de bon). Une
 * réponse ou un passage relance l'analyse, suivie par le panneau du matching
 * (SSE). Jamais la justification de l'évaluation.
 */
export function ClarificationPanel({ publicId, matching }: { publicId: string; matching: Matching }) {
  if (matching.assessmentFinished) {
    return (
      <Alert variant="success" title="Assessment complete">
        No more questions will be asked. You can now give your own view on each criterion in “Your
        assessment”.
      </Alert>
    );
  }
  if (matching.clarification) {
    // Une question = un formulaire neuf (texte, erreurs, confirmation) : clé par question.
    return (
      <ClarificationQuestion
        key={matching.clarification.id}
        publicId={publicId}
        clarification={matching.clarification}
      />
    );
  }
  return <NoOpenQuestion publicId={publicId} />;
}
