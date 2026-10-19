"use client";

import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ITEM_CARD_CLASS, MUTED_TEXT_CLASS } from "@/components/ui/section";
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
    resetErrors();
    skip.mutate(clarification.id);
  };

  return (
    <section aria-label="AI clarification" className={`${ITEM_CARD_CLASS} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
          AI clarification
        </h3>
        <Badge tone="accent">{remainingLabel(clarification.remainingQuestions)}</Badge>
      </div>
      <p className="text-body-md font-body-md font-semibold text-text-primary break-words">
        {clarification.question}
      </p>
      <p className={`${MUTED_TEXT_CLASS} break-words`}>
        <span className="font-semibold">Why we ask: </span>
        {clarification.rationale}
      </p>

      <form onSubmit={handleAnswer} noValidate className="flex flex-col gap-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <CtaButton type="submit" icon="send" busy={answer.isPending} disabled={busy}>
            Answer
          </CtaButton>
          <Button variant="outline-sm" type="button" busy={skip.isPending} disabled={busy} onClick={handleSkip}>
            Pass this question
          </Button>
          <Button
            variant="outline-sm"
            type="button"
            disabled={busy}
            onClick={() => {
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
    <div className="flex flex-col items-start gap-3">
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
  );
}

/**
 * Clarifications IA d'un matching terminé (T-62) : la question ouverte et la
 * raison pour laquelle elle est posée, le plafond restant, puis Answer / Pass /
 * Finish (confirmé — l'évaluation se clôt pour de bon). Une réponse ou un
 * passage relance l'analyse, suivie par le panneau du matching (SSE). Jamais
 * la justification de l'évaluation.
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
