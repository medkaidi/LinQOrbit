"use client";

import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";

import { Button, CtaButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Select, type SelectOption } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { RemoveButton } from "@/features/candidate/profile-shared";
import {
  OFFER_ITEM_CARD,
  OFFER_MUTED,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
  QUESTION_TYPE_LABELS,
} from "@/features/job-offer/job-offer-shared";
import {
  isChoiceQuestionType,
  QUESTION_TYPES,
  type CreateJobOfferValues,
} from "@/lib/validations/job-offer.schemas";

const QUESTION_TYPE_OPTIONS: SelectOption[] = QUESTION_TYPES.map((value) => ({
  value,
  label: QUESTION_TYPE_LABELS[value],
}));

const emptyOption = () => ({ label: "", preferred: false });

export const emptyQuestion = (): CreateJobOfferValues["questions"][number] => ({
  label: "",
  type: "text",
  isRequired: false,
  options: [],
});

function QuestionCard({
  index,
  control,
  errors,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  control: Control<CreateJobOfferValues>;
  errors: FieldErrors<CreateJobOfferValues>;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const optionRows = useFieldArray({
    control,
    name: `questions.${index}.options`,
  });
  const type = useWatch({ control, name: `questions.${index}.type` });
  const isChoice = isChoiceQuestionType(type ?? "");
  const questionError = errors.questions?.[index];
  const optionsError = questionError?.options;

  return (
    <li className={OFFER_ITEM_CARD}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Controller
            control={control}
            name={`questions.${index}.label`}
            render={({ field, fieldState }) => (
              <TextField
                label={`Question ${index + 1}`}
                placeholder="e.g. How many years with Java?"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="w-44">
          <Controller
            control={control}
            name={`questions.${index}.type`}
            render={({ field, fieldState }) => (
              <Select
                label="Type"
                options={QUESTION_TYPE_OPTIONS}
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  // Règle de masquage : hors type à choix, les options n'existent plus.
                  if (!isChoiceQuestionType(next)) {
                    optionRows.replace([]);
                  }
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="h-11 flex items-center gap-2">
          <Button
            variant="outline-sm"
            type="button"
            aria-label="Move question up"
            title="Move up"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <Icon name="arrow_upward" className="text-[16px]!" />
          </Button>
          <Button
            variant="outline-sm"
            type="button"
            aria-label="Move question down"
            title="Move down"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <Icon name="arrow_downward" className="text-[16px]!" />
          </Button>
          <RemoveButton onClick={onRemove} />
        </div>
      </div>

      <div className="mt-3 h-6 flex items-center">
        <Controller
          control={control}
          name={`questions.${index}.isRequired`}
          render={({ field }) => (
            <Checkbox
              label="Required"
              checked={field.value === true}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </div>

      {isChoice ? (
        <div className="mt-3 pl-4 border-l border-slate-border flex flex-col items-start gap-3">
          {optionRows.fields.length > 0 ? (
            <ul className="flex flex-col gap-3 w-full">
              {optionRows.fields.map((option, optionIndex) => (
                <li key={option.id} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-52 flex-1">
                    <Controller
                      control={control}
                      name={`questions.${index}.options.${optionIndex}.label`}
                      render={({ field, fieldState }) => (
                        <TextField
                          label={`Option ${optionIndex + 1}`}
                          placeholder="e.g. Remote"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  </div>
                  <div className="h-11 flex items-center">
                    <Controller
                      control={control}
                      name={`questions.${index}.options.${optionIndex}.preferred`}
                      render={({ field }) => (
                        <Checkbox
                          label="Preferred"
                          checked={field.value === true}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>
                  <div className="h-11 flex items-center">
                    <RemoveButton onClick={() => optionRows.remove(optionIndex)} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {optionsError !== undefined && !Array.isArray(optionsError) ? (
            <p className="text-body-sm font-body-sm text-danger">{optionsError.message}</p>
          ) : null}
          <CtaButton
            type="button"
            tone="secondary"
            icon="add"
            onClick={() => optionRows.append(emptyOption())}
          >
            Add option
          </CtaButton>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Section « Screening questions » du formulaire d'offre (D47) : questions à
 * choix unique/multiple avec options (dont `preferred`, visible du seul
 * recruteur), autres types sans options ; l'ordre des cartes est l'ordre
 * métier (`sortOrder` dérivé de l'index dans la couche API).
 */
export function OfferQuestionsSection({
  control,
  errors,
}: {
  control: Control<CreateJobOfferValues>;
  errors: FieldErrors<CreateJobOfferValues>;
}) {
  const questionRows = useFieldArray({ control, name: "questions" });

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={OFFER_SECTION_HEADER}>
        <h2 className={OFFER_SECTION_TITLE}>Screening questions</h2>
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
        {questionRows.fields.length === 0 ? (
          <p className={OFFER_MUTED}>
            No screening questions yet. Add the questions candidates answer when
            they apply.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 w-full">
            {questionRows.fields.map((row, index) => (
              <QuestionCard
                key={row.id}
                index={index}
                control={control}
                errors={errors}
                isFirst={index === 0}
                isLast={index === questionRows.fields.length - 1}
                onMoveUp={() => questionRows.move(index, index - 1)}
                onMoveDown={() => questionRows.move(index, index + 1)}
                onRemove={() => questionRows.remove(index)}
              />
            ))}
          </ul>
        )}
        <CtaButton
          type="button"
          tone="secondary"
          icon="add"
          onClick={() => questionRows.append(emptyQuestion())}
        >
          Add question
        </CtaButton>
      </div>
    </section>
  );
}
