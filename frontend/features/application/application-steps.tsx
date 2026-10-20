import { Icon } from "@/components/ui/icon";
import { SECTION_CARD_CLASS } from "@/components/ui/section";
import { cn } from "@/lib/utils/cn";
import type { ApplicationAssessment, ApplicationStep } from "@/types/application";

type StepState = "complete" | "current" | "upcoming" | "skipped";

type StepKey = "questions" | "clarifications" | "review" | "summary";

type StepDefinition = {
  key: StepKey;
  label: string;
};

/**
 * Étapes du parcours (D59, maquette `matching_screen_upper_drawer_*`). Le
 * matching ouvre l'étape « AI clarifications » (T-62), juste après les
 * questions du recruteur ; l'évaluation close ouvre la « Candidate review »
 * (T-63). Une étape que le candidat n'a pas faite avant de transmettre est
 * « Skipped », jamais « Done ».
 */
const STEPS: StepDefinition[] = [
  { key: "questions", label: "Recruiter questions" },
  { key: "clarifications", label: "AI clarifications" },
  { key: "review", label: "Candidate review" },
  { key: "summary", label: "Summary & apply" },
];

/**
 * État de chaque étape, lu de l'étape et de l'état d'évaluation **calculés par
 * le serveur** (jamais déduits côté client).
 */
function stateOf(step: StepKey, current: ApplicationStep, assessment: ApplicationAssessment): StepState {
  if (current === "submitted") {
    if (step === "clarifications") {
      // Une évaluation encore ouverte à la transmission n'est pas marquée « Done ».
      return assessment.matched && assessment.assessmentFinished ? "complete" : "skipped";
    }
    if (step === "review") {
      return assessment.contested ? "complete" : "skipped";
    }
    return "complete";
  }
  if (current === "recruiter_questions") {
    return step === "questions" ? "current" : "upcoming";
  }
  // Étape « matching » : questions faites. Sans matching, l'évaluation est
  // sautée et la transmission devient l'étape courante (le matching reste
  // facultatif, D59/D7).
  if (!assessment.matched) {
    switch (step) {
      case "questions":
        return "complete";
      case "clarifications":
      case "review":
        return "skipped";
      default:
        return "current";
    }
  }
  switch (step) {
    case "questions":
      return "complete";
    case "clarifications":
      return assessment.assessmentOpen ? "current" : "complete";
    case "review":
      return assessment.assessmentOpen ? "upcoming" : "current";
    default:
      return "upcoming";
  }
}

const CARD_CLASSES: Record<StepState, string> = {
  complete: "bg-item-surface border-slate-border",
  current: "bg-orange-subtle/60 border-orange-border",
  upcoming: "bg-canvas-white border-slate-border opacity-60",
  skipped: "bg-item-surface border-slate-border",
};

const HEADER_CLASSES: Record<StepState, string> = {
  complete: "text-success-text",
  current: "text-orange-deep",
  upcoming: "text-text-tertiary",
  skipped: "text-text-tertiary",
};

const ICONS: Record<StepState, string> = {
  complete: "check_circle",
  current: "play_circle",
  upcoming: "radio_button_unchecked",
  skipped: "do_not_disturb_on",
};

const HINT_CLASSES: Record<StepState, string> = {
  complete: "text-success-text font-semibold",
  current: "text-orange-deep font-semibold",
  upcoming: "text-text-tertiary",
  skipped: "text-text-tertiary",
};

function hintOf(state: StepState, isLast: boolean): string {
  switch (state) {
    case "complete":
      return "Done";
    case "current":
      return "In progress";
    case "skipped":
      return "Skipped";
    default:
      return isLast ? "Final step" : "Upcoming";
  }
}

/**
 * Indicateur d'avancement de la candidature (cartes de la maquette) : quatre
 * étapes, trois quand l'offre n'a aucune question du recruteur — le parcours
 * s'ouvre alors directement sur les clarifications IA.
 */
export function ApplicationSteps({
  step,
  assessment,
  hasRecruiterQuestions,
}: {
  step: ApplicationStep;
  assessment: ApplicationAssessment;
  hasRecruiterQuestions: boolean;
}) {
  const steps = hasRecruiterQuestions ? STEPS : STEPS.filter((definition) => definition.key !== "questions");
  return (
    <section aria-label="Application progress" className={cn(SECTION_CARD_CLASS, "p-4 lg:p-5")}>
      <ol className={cn("grid grid-cols-2 gap-2.5", steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
        {steps.map((definition, index) => {
          const state = stateOf(definition.key, step, assessment);
          return (
            <li
              key={definition.key}
              aria-current={state === "current" ? "step" : undefined}
              className={cn("p-2.5 rounded-2xl border", CARD_CLASSES[state])}
            >
              <span className={cn("flex items-center gap-1.5 mb-1", HEADER_CLASSES[state])}>
                <Icon name={ICONS[state]} className="text-[16px]" />
                <span className="font-label-caps text-label-caps uppercase tracking-wider">Step {index + 1}</span>
              </span>
              <span
                className={cn(
                  "block font-label-md text-label-md text-text-primary",
                  state === "upcoming" ? "font-medium" : "font-bold",
                )}
              >
                {definition.label}
              </span>
              <span className={cn("block text-[11px] leading-4", HINT_CLASSES[state])}>
                {hintOf(state, index === steps.length - 1)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
