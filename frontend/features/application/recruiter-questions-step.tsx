"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { IndexBadge } from "@/components/ui/index-badge";
import { MUTED_TEXT_CLASS, SECTION_CARD_CLASS, SECTION_TITLE_CLASS } from "@/components/ui/section";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import {
  buildAnswerRequests,
  draftsFromAnswers,
  emptyAnswerDraft,
  invalidAnswerNumbers,
  isStorableAnswerNumber,
  toAnswerRequest,
  unansweredRequired,
  type AnswerDraft,
} from "@/features/application/answer-drafts";
import { useSaveApplicationDraft } from "@/hooks/use-applications";
import { cn } from "@/lib/utils/cn";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { ApplicationContext, ApplicationQuestionView } from "@/types/application";

const YES_NO_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Saisie numérique non stockable (miroir NUMERIC(12,2) du backend), signalée sur le champ même. */
function numberError(raw: string): string | undefined {
  const value = raw.trim();
  return value !== "" && !isStorableAnswerNumber(Number(value))
    ? "Use a number below 10 billion with at most two decimals."
    : undefined;
}

/** Carte d'option (choix unique ou multiple) : toute la carte est cliquable, la sélection se voit à sa bordure. */
function choiceCardClass(selected: boolean): string {
  return cn(
    "flex items-start gap-3 p-3.5 rounded-2xl border bg-canvas-white cursor-pointer transition-colors font-body-md text-body-md text-text-primary",
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-deep",
    // Sélection sans fond teinté : fine bordure orange + bouton coché.
    selected ? "border-primary-container" : "border-slate-border hover:border-slate-border-strong",
  );
}

function ChoiceCards({
  titleId,
  required,
  multiple,
  options,
  selected,
  onToggle,
}: {
  titleId: string;
  required: boolean;
  multiple: boolean;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}) {
  const name = useId();
  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby={titleId}
      aria-required={!multiple && required ? true : undefined}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <label key={option.value} className={choiceCardClass(isSelected)}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={(event) => onToggle(option.value, event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary-container cursor-pointer"
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function QuestionField({
  question,
  titleId,
  draft,
  onChange,
}: {
  question: ApplicationQuestionView;
  titleId: string;
  draft: AnswerDraft;
  onChange: (draft: AnswerDraft) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Textarea
          label={question.label}
          hideLabel
          aria-required={question.isRequired || undefined}
          placeholder="Type your answer"
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
        />
      );
    case "number":
      return (
        <div className="max-w-xs">
          <TextField
            label={question.label}
            hideLabel
            aria-required={question.isRequired || undefined}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="0"
            value={draft.number}
            error={numberError(draft.number)}
            onChange={(event) => onChange({ ...draft, number: event.target.value })}
          />
        </div>
      );
    case "yes_no":
      return (
        <ChoiceCards
          titleId={titleId}
          required={question.isRequired}
          multiple={false}
          options={YES_NO_OPTIONS}
          selected={draft.yesNo ? [draft.yesNo] : []}
          onToggle={(value) => onChange({ ...draft, yesNo: value as AnswerDraft["yesNo"] })}
        />
      );
    case "single_choice":
      return (
        <ChoiceCards
          titleId={titleId}
          required={question.isRequired}
          multiple={false}
          options={question.options.map((option) => ({ value: option.id, label: option.label }))}
          selected={draft.optionIds}
          onToggle={(value) => onChange({ ...draft, optionIds: [value] })}
        />
      );
    case "multiple_choice":
      return (
        <ChoiceCards
          titleId={titleId}
          required={question.isRequired}
          multiple
          options={question.options.map((option) => ({ value: option.id, label: option.label }))}
          selected={draft.optionIds}
          onToggle={(value, checked) =>
            onChange({
              ...draft,
              optionIds: checked
                ? [...draft.optionIds, value]
                : draft.optionIds.filter((id) => id !== value),
            })
          }
        />
      );
  }
}

/** Une question = une carte : numéro, libellé en titre, pastille Required/Optional, puis le champ. */
function QuestionCard({ index, question, children }: {
  index: number;
  question: ApplicationQuestionView;
  children: (titleId: string) => ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn(SECTION_CARD_CLASS, "p-5 lg:p-6 flex flex-col gap-4")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <IndexBadge>{index + 1}</IndexBadge>
          <h3
            id={titleId}
            className="pt-0.5 font-headline-sm text-headline-sm font-medium text-text-primary break-words"
          >
            {question.label}
          </h3>
        </div>
        {question.isRequired ? (
          <Badge tone="accent">Required</Badge>
        ) : (
          <Badge tone="outline">Optional</Badge>
        )}
      </div>
      {children(titleId)}
    </section>
  );
}

/**
 * Étape 1 du parcours (D59, maquette `recruiter_questions.html` — éléments
 * sans donnée réelle écartés) : une carte par question, pleine largeur, toutes
 * sur un écran (fixes et indépendantes), enregistrées en **brouillon** — partiel
 * permis, pré-rempli par les réponses déjà enregistrées. Barre d'actions
 * collante : compteur de réponses, « Save and quit » (enregistre puis ramène à
 * « My applications ») et « Save and continue » (n'avance que lorsque toutes
 * les obligatoires sont répondues, miroir de la vérification serveur). Le
 * détail serveur est affiché tel quel.
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
  const titleId = useId();

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
      const missing = unansweredRequired(context.questions, drafts);
      if (missing.length > 0) {
        setNotice(`Your answers are saved. Still required to continue: ${missing.join(", ")}.`);
        return;
      }
      onContinue();
    });
  };

  const errorMessage = localError ?? (save.error ? getApiErrorMessage(save.error) : null);
  const answered = context.questions.filter(
    (question) => toAnswerRequest(question, drafts[question.id] ?? emptyAnswerDraft()) !== null,
  ).length;

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleContinue} aria-labelledby={titleId}>
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className={SECTION_TITLE_CLASS}>
          Recruiter questions
        </h2>
        <p className={MUTED_TEXT_CLASS}>
          Required questions must be answered to continue. Your answers are saved as a draft.
        </p>
      </header>

      {context.questions.map((question, index) => (
        <QuestionCard key={question.id} index={index} question={question}>
          {(titleId) => (
            <QuestionField
              question={question}
              titleId={titleId}
              draft={drafts[question.id] ?? emptyAnswerDraft()}
              onChange={(draft) => setDrafts((previous) => ({ ...previous, [question.id]: draft }))}
            />
          )}
        </QuestionCard>
      ))}

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

      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl sm:rounded-full border border-slate-border bg-canvas-white/95 backdrop-blur-md shadow-lg p-2.5 sm:pl-6">
        <p className="font-label-md text-label-md text-text-secondary" aria-live="polite">
          {answered} of {context.questions.length} answered
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline-sm"
            type="button"
            disabled={save.isPending}
            onClick={() => persist(() => router.push("/applications"))}
          >
            Save and quit
          </Button>
          <CtaButton type="submit" icon="arrow_forward" busy={save.isPending}>
            Save and continue
          </CtaButton>
        </div>
      </div>
    </form>
  );
}
