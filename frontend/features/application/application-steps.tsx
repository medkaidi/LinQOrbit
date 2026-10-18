import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { ApplicationStep } from "@/types/application";

type StepState = "complete" | "current" | "upcoming";

type StepDefinition = {
  key: "questions" | "match" | "submit";
  label: string;
  hint: string;
};

/**
 * Étapes affichées au MVP (D59). Clarifications IA et arbitrage rejoignent la
 * liste avec T-62/T-63 — jamais d'étape sans fonctionnalité derrière.
 */
const STEPS: StepDefinition[] = [
  { key: "questions", label: "Recruiter questions", hint: "Required to continue" },
  { key: "match", label: "Match", hint: "Optional" },
  { key: "submit", label: "Submit", hint: "Send your application" },
];

/** État de chaque étape, lu de l'étape calculée par le serveur (jamais déduit côté client). */
function stateOf(step: StepDefinition["key"], current: ApplicationStep): StepState {
  if (current === "submitted") {
    return "complete";
  }
  if (current === "recruiter_questions") {
    return step === "questions" ? "current" : "upcoming";
  }
  // Étape « matching » : questions faites ; le matching est en cours et la transmission ouverte.
  if (step === "questions") {
    return "complete";
  }
  return step === "match" ? "current" : "upcoming";
}

const BULLET_CLASSES: Record<StepState, string> = {
  complete: "bg-success-surface border-success-border text-success-text",
  current: "bg-orange-subtle border-orange-border text-orange-deep",
  upcoming: "bg-canvas-white border-slate-border text-text-tertiary",
};

const BULLET_ICONS: Record<StepState, string> = {
  complete: "check_circle",
  current: "play_circle",
  upcoming: "radio_button_unchecked",
};

/** Indicateur d'avancement de la candidature (maquette `matching_screen_upper_drawer_*`). */
export function ApplicationSteps({ step }: { step: ApplicationStep }) {
  return (
    <nav aria-label="Application progress">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((definition, index) => {
          const state = stateOf(definition.key, step);
          return (
            <li
              key={definition.key}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3",
                state === "current" ? "border-orange-border bg-canvas-white" : "border-slate-border bg-canvas-white",
              )}
            >
              <span
                className={cn(
                  "w-8 h-8 shrink-0 rounded-full border flex items-center justify-center",
                  BULLET_CLASSES[state],
                )}
              >
                <Icon name={BULLET_ICONS[state]} className="text-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Step {index + 1}
                </span>
                <span className="block text-body-sm font-body-sm font-semibold text-text-primary">
                  {definition.label}
                </span>
                <span className="block text-body-sm font-body-sm text-text-secondary">
                  {state === "complete" ? "Done" : definition.hint}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
