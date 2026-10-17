"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import {
  APPLICATION_MUTED,
  APPLICATION_SECTION,
  APPLICATION_SECTION_HEADER,
  APPLICATION_SECTION_TITLE,
} from "@/features/application/application-shared";
import {
  buildAnswerRequests,
  emptyAnswerDrafts,
  invalidAnswerNumbers,
  unansweredRequired,
  type AnswerDraft,
} from "@/features/application/answer-drafts";
import { useCandidateCvs } from "@/hooks/use-candidate-cvs";
import { useSubmitApplication } from "@/hooks/use-applications";
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
 * Formulaire de candidature (D48) : questions de présélection dynamiques
 * (5 types), CV à épingler (courant pré-sélectionné) et soumission. Les
 * validations clientes miroitent les messages backend ; `getApiErrorMessage`
 * affiche le détail serveur tel quel (409 doublon, CV manquant…).
 */
export function ApplicationForm({ context }: { context: ApplicationContext }) {
  const router = useRouter();
  const cvs = useCandidateCvs();
  const submit = useSubmitApplication();
  const [cvId, setCvId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>(() =>
    emptyAnswerDrafts(context.questions),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const cvsLoading = cvs.isLoading;
  const hasCvs = (cvs.data?.length ?? 0) > 0;
  const cvOptions = (cvs.data ?? []).map((cv) => ({
    value: cv.id,
    label: cv.current ? `${cv.originalName} (current)` : cv.originalName,
  }));
  // CV effectif : choix utilisateur sinon CV courant du contexte sinon premier CV.
  const effectiveCvId =
    cvId !== ""
      ? cvId
      : (context.currentCvAttachmentId ??
        cvs.data?.find((cv) => cv.current)?.id ??
        cvs.data?.[0]?.id ??
        "");

  const submitError = submit.error ? getApiErrorMessage(submit.error) : null;
  const errorMessage = localError ?? submitError;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const invalid = invalidAnswerNumbers(context.questions, drafts);
    if (invalid.length > 0) {
      setLocalError(`Answer for question '${invalid[0]}' is invalid.`);
      return;
    }
    const missing = unansweredRequired(context.questions, drafts);
    if (missing.length > 0) {
      setLocalError("All required questions must be answered.");
      return;
    }

    submit.mutate(
      {
        jobPublicId: context.job.publicId,
        ...(effectiveCvId !== "" ? { cvAttachmentId: effectiveCvId } : {}),
        answers: buildAnswerRequests(context.questions, drafts),
      },
      { onSuccess: () => router.push("/applications") },
    );
  };

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      {context.questions.length > 0 ? (
        <section className={APPLICATION_SECTION}>
          <header className={APPLICATION_SECTION_HEADER}>
            <h2 className={APPLICATION_SECTION_TITLE}>Screening questions</h2>
          </header>
          <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
            <p className={APPLICATION_MUTED}>Questions marked with * are required.</p>
            {context.questions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                draft={drafts[question.id]}
                onChange={(draft) =>
                  setDrafts((previous) => ({ ...previous, [question.id]: draft }))
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={APPLICATION_SECTION}>
        <header className={APPLICATION_SECTION_HEADER}>
          <h2 className={APPLICATION_SECTION_TITLE}>Application</h2>
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
          {cvsLoading ? (
            <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
              <Spinner />
              Loading your CVs…
            </span>
          ) : null}

          {cvs.isError ? (
            <Alert variant="error" title="Could not load your CVs">
              Reload the page to try again.
            </Alert>
          ) : null}

          {!cvsLoading && !cvs.isError && !hasCvs ? (
            <Alert variant="error" title="A CV is required">
              Add a CV to your profile before applying —{" "}
              <Link href="/profile/edit" className="underline hover:text-orange-deep">
                go to your profile
              </Link>
              .
            </Alert>
          ) : null}

          {hasCvs ? (
            <div className="w-full max-w-md">
              <Select
                label="CV to attach"
                options={cvOptions}
                placeholder="Select a CV"
                value={effectiveCvId}
                onValueChange={setCvId}
              />
            </div>
          ) : null}

          <CtaButton
            type="submit"
            icon="send"
            busy={submit.isPending}
            disabled={cvsLoading || !hasCvs}
          >
            Submit application
          </CtaButton>

          {errorMessage ? (
            <Alert variant="error" title="Submission failed">
              {errorMessage}
            </Alert>
          ) : null}
        </div>
      </section>
    </form>
  );
}
