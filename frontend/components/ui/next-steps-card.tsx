import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";

export type NextStep = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  href: string;
};

type NextStepsCardProps = {
  steps: NextStep[];
  /** Titre de la carte : « Next steps » par défaut, « Needs your attention » côté admin. */
  title?: string;
  /** Sans étape, `loading` montre un chargement, `failed` un échec, `ready` le message de fin. */
  state: "loading" | "failed" | "ready";
  readyMessage?: string;
  failedMessage?: string;
};

/**
 * Espacement vertical de chaque ligne, porté par le `<li>` — jamais par le lien qu'il contient :
 * le lien est l'unique enfant de son `<li>`, donc à la fois premier et dernier, et un `first:pt-0
 * last:pb-0` posé dessus annulerait le padding de toutes les lignes (filet collé au texte).
 */
const STEP_ROW_CLASS = "py-4 first:pt-0 last:pb-0";

/**
 * Carte « Next steps » des tableaux de bord candidat, recruteur et admin : des étapes déduites de l'état
 * réel du compte, chacune un lien. L'appelant calcule les étapes et l'état de ses sources ; une
 * source encore inconnue ne produit aucune étape (on ne suggère jamais sur une donnée absente).
 */
export function NextStepsCard({
  steps,
  title = "Next steps",
  state,
  readyMessage = "You're all set — nothing needs your attention right now.",
  failedMessage = "Some of your information could not be loaded.",
}: NextStepsCardProps) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label={title}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      </header>
      <div className="px-6 pt-4 pb-5">
        {steps.length > 0 ? (
          <ul className="flex flex-col divide-y divide-slate-border">
            {steps.map((step) => (
              <li key={step.id} className={STEP_ROW_CLASS}>
                <Link
                  href={step.href}
                  className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
                >
                  <IconBadge icon={step.icon} tone="primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-label-lg text-label-lg font-bold text-text-primary group-hover:text-orange-deep transition-colors">
                      {step.title}
                    </span>
                    <span className="block truncate text-body-sm font-body-sm text-text-tertiary">
                      {step.detail}
                    </span>
                  </span>
                  <Icon name="chevron_right" className="text-[18px] text-text-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {steps.length === 0 && state === "ready" ? <p className={MUTED_TEXT_CLASS}>{readyMessage}</p> : null}
        {steps.length === 0 && state === "failed" ? <p className={MUTED_TEXT_CLASS}>{failedMessage}</p> : null}
        {steps.length === 0 && state === "loading" ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </span>
        ) : null}
      </div>
    </section>
  );
}
