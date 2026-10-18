"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import {
  buildAnswerRequests,
  draftsFromAnswers,
  invalidAnswerNumbers,
  unansweredRequired,
  type AnswerDraft,
} from "@/features/application/answer-drafts";
import { useSaveApplicationDraft } from "@/hooks/use-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { ApplicationContext, ApplicationQuestionView } from "@/types/application";

const YES_NO_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function requiredLabel(question: ApplicationQuestionView): string {
  return question.isRequired ? `${question.label} *` : question.label;
}

function QuestionField({
  question,
  draft,
  onChange,
}: {
  question: ApplicationQuestionView;
  draft: AnswerDraft;
  onChange: (draft: AnswerDraft) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Textarea
          label={requiredLabel(question)}
          placeholder="Type your answer"
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
        />
      );
    case "number":
      return (
        <TextField
          label={requiredLabel(question)}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="0"
          value={draft.number}
          onChange={(event) => onChange({ ...draft, number: event.target.value })}
        />
      );
    case "yes_no":
      return (
        <Select
          label={requiredLabel(question)}
          options={YES_NO_OPTIONS}
          placeholder="Select one"
          value={draft.yesNo}
          onValueChange={(value) => onChange({ ...draft, yesNo: value as AnswerDraft["yesNo"] })}
        />
      );
    case "single_choice":
      return (
        <Select
          label={requiredLabel(question)}
          options={question.options.map((option) => ({ value: option.id, label: option.label }))}
          placeholder="Select one"
          value={draft.optionIds[0] ?? ""}
          onValueChange={(value) => onChange({ ...draft, optionIds: [value] })}
        />
      );
    case "multiple_choice":
      return (
        <fieldset>
          <legend className="font-label-md text-label-md text-text-secondary">
            {requiredLabel(question)}
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {question.options.map((option) => (
              <Checkbox
                key={option.id}
                label={option.label}
                checked={draft.optionIds.includes(option.id)}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    optionIds: event.target.checked
                      ? [...draft.optionIds, option.id]
                      : draft.optionIds.filter((id) => id !== option.id),
                  })
                }
              />
            ))}
          </div>
        </fieldset>
      );
  }
}

/**
 * Étape 1 du parcours (D59) : les questions du recruteur, toutes sur un écran
 * (fixes et indépendantes), enregistrées en **brouillon** — partiel permis,
 * pré-rempli par les réponses déjà enregistrées. « Save and continue »
 * n'avance que lorsque toutes les obligatoires sont répondues (miroir de la
 * vérification serveur) ; « Save and quit » enregistre puis ramène à « My
 * applications ». Les messages miroitent le backend ; le détail serveur est
 * affiché tel quel.
 */
export function RecruiterQuestionsStep({
  context,
  onContinue,
}: {
  context: ApplicationContext;
  onContinue: () => void;
}) {
  const router = useRouter();
  const save = useSaveApplicationDraft();
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>(() =>
    draftsFromAnswers(context.questions, context.answers),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const persist = (afterSave: () => void) => {
    setLocalError(null);
    setNotice(null);
    const invalid = invalidAnswerNumbers(context.questions, drafts);
    if (invalid.length > 0) {
      setLocalError(`Answer for question '${invalid[0]}' is invalid.`);
      return;
    }
    save.mutate(
      { jobPublicId: context.job.publicId, answers: buildAnswerRequests(context.questions, drafts) },
      { onSuccess: afterSave },
    );
  };

  const handleContinue = (event: FormEvent) => {
    event.preventDefault();
    persist(() => {
      if (unansweredRequired(context.questions, drafts).length > 0) {
        setNotice("Your answers are saved. Answer every required question (*) to continue.");
        return;
      }
      onContinue();
    });
  };

  const errorMessage = localError ?? (save.error ? getApiErrorMessage(save.error) : null);

  return (
    <form className={SECTION_CARD_CLASS} noValidate onSubmit={handleContinue}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Recruiter questions</h2>
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
        {context.questions.length > 0 ? (
          <>
            <p className={MUTED_TEXT_CLASS}>
              Questions marked with * are required to continue. Your answers are saved as a draft.
            </p>
            {context.questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                draft={drafts[question.id]}
                onChange={(draft) => setDrafts((previous) => ({ ...previous, [question.id]: draft }))}
              />
            ))}
          </>
        ) : (
          <p className={MUTED_TEXT_CLASS}>The recruiter did not ask any question for this offer.</p>
        )}

        {notice ? (
          <Alert variant="info" title="Draft saved">
            {notice}
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert variant="error" title="Could not save your answers">
            {errorMessage}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <CtaButton type="submit" icon="arrow_forward" busy={save.isPending}>
            Save and continue
          </CtaButton>
          <Button
            variant="outline-sm"
            type="button"
            disabled={save.isPending}
            onClick={() => persist(() => router.push("/applications"))}
          >
            Save and quit
          </Button>
        </div>
      </div>
    </form>
  );
}
