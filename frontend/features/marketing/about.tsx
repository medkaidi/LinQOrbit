import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

/**
 * Les quatre principes non négociables du produit (SPEC §1.2). Le contenu de
 * cette page ne décrit que ce qui est implémenté : aucun chiffre inventé,
 * aucun agent fictif, aucune promesse commerciale.
 */
const PILLARS = [
  {
    icon: "account_balance",
    num: "Principle 01",
    title: "The AI does not decide",
    body: "LinQOrbit never states that a candidate is the right one. It produces verifiable observations — “Java: detected”, “Experience Java: 5 years declared”, “Match Java: 95 %” — and the recruiter decides.",
    tag: "Human decision",
  },
  {
    icon: "visibility",
    num: "Principle 02",
    title: "Transparency",
    body: "The candidate sees how their profile was interpreted: the criteria evaluated, the match for each one, the clarifications requested — and can contest a score or report a misreading.",
    tag: "Contestable scores",
  },
  {
    icon: "hub",
    num: "Principle 03",
    title: "One engine, three uses",
    body: "Candidate → offers, offer → candidates, offer ↔ candidate: the same comparison engine, always applied to normalized profiles and offers. No screen has its own algorithm.",
    tag: "Single matching engine",
  },
  {
    icon: "description",
    num: "Principle 04",
    title: "A normalized sheet as common language",
    body: "Profiles and job offers are normalized into a structured sheet before any comparison, so every search and every match rests on the same data.",
    tag: "Shared structure",
  },
] as const;

/**
 * Illustration d'une évaluation réelle : les exemples de score viennent de la
 * fiche produit (SPEC §1.2 et §8.2), y compris la catégorie « informations
 * insuffisantes » — un silence n'est jamais transformé en négatif.
 */
const EVALUATIONS = [
  { label: "Java", detail: "detected", value: 95 },
  { label: "Experience Java", detail: "5 years declared", value: 94 },
  { label: "Spring Boot", detail: "insufficient information", value: null },
  { label: "React", detail: "declared", value: 72 },
] as const;

const CAPABILITIES = [
  {
    icon: "scale",
    title: "Mandatory and preferred, weighted separately",
    body: "A weakness on a mandatory criterion is not compensated by strong preferred criteria: each set is scored on its own 100 % scale.",
  },
  {
    icon: "help",
    title: "Insufficient information is not “not possessed”",
    body: "When a profile carries no usable information on a criterion, the evaluation says so — a missing answer is never read as a negative.",
  },
] as const;

export function About() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Our Mission & Vision"
        title={
          <>
            Matching Job Offers and Candidate Profiles,{" "}
            <span className="text-primary-container">Criterion by Criterion</span>
          </>
        }
        lede="LinQOrbit structures, analyses and matches job offers and candidate profiles with AI. The AI produces verifiable observations, criterion by criterion; the recruiter makes the final decision."
        actions={
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg transition-colors duration-150"
          >
            Contact us
            <Icon name="arrow_forward" className="ml-2 text-[18px]" />
          </Link>
        }
      />

      <section className="w-full py-16 lg:py-24 bg-canvas-subtle">
        <div className="max-w-7xl mx-auto px-gutter">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md uppercase tracking-wider mb-3">
                Guiding Philosophy
              </div>
              <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                Four Non-Negotiable Principles
              </h2>
            </div>
            <p className="font-body-md text-body-md text-text-secondary max-w-md">
              Every layer of LinQOrbit follows the same rule: the AI observes and explains, the
              human decides.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map((pillar) => (
              <article
                key={pillar.num}
                className="flex flex-col justify-between p-8 rounded-xl bg-canvas-white shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="w-12 h-12 rounded-full bg-orange-subtle flex items-center justify-center text-primary-container mb-6">
                    <Icon name={pillar.icon} className="text-[26px]" />
                  </div>
                  <span className="font-label-caps text-label-caps text-text-tertiary uppercase tracking-widest block mb-1">
                    {pillar.num}
                  </span>
                  <h3 className="font-headline-md text-headline-md text-text-primary mb-3">
                    {pillar.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
                <div className="mt-6 pt-4 flex items-center gap-2 text-primary-container font-label-md text-label-md">
                  <span>{pillar.tag}</span>
                  <Icon name="check_circle" className="text-[16px]" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-16 lg:py-24 bg-canvas-white">
        <div className="max-w-7xl mx-auto px-gutter">
          <div className="rounded-xl bg-surface-container-low p-8 lg:p-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md">
                  <span className="w-2 h-2 rounded-full bg-primary-container" />
                  Matching engine
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Criterion-by-Criterion Evaluation
                </h2>
                <p className="font-body-md text-body-md text-text-secondary">
                  An offer is broken into weighted criteria, and each one is compared with the
                  profile on its own terms. The platform computes the scores; the language model
                  reads and interprets the texts.
                </p>
                <div className="space-y-4 pt-2">
                  {CAPABILITIES.map((capability) => (
                    <div key={capability.title} className="flex items-start gap-3">
                      <Icon
                        name={capability.icon}
                        className="text-primary-container text-[20px] mt-0.5 shrink-0"
                      />
                      <div>
                        <h4 className="font-headline-sm text-headline-sm text-text-primary">
                          {capability.title}
                        </h4>
                        <p className="font-body-sm text-body-sm text-text-secondary">
                          {capability.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="bg-canvas-white rounded-xl p-6 lg:p-8 shadow-sm">
                  <div className="flex items-center justify-between gap-3 pb-6 mb-6 bg-canvas-subtle p-4 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-3 h-3 rounded-full bg-tertiary-container shrink-0" />
                      <div className="min-w-0">
                        <div className="font-headline-sm text-headline-sm text-text-primary truncate">
                          Example — candidate evaluation
                        </div>
                        <div className="font-body-sm text-body-sm text-text-tertiary truncate">
                          One score per criterion, never a single global score
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md shrink-0">
                      Mandatory 92 % · Preferred 68 %
                    </span>
                  </div>

                  <div className="space-y-5">
                    {EVALUATIONS.map((evaluation) => (
                      <div key={evaluation.label}>
                        <div className="flex justify-between font-label-md text-label-md mb-2 gap-3">
                          <span className="text-text-primary">
                            {evaluation.label}
                            <span className="ml-2 text-text-tertiary">{evaluation.detail}</span>
                          </span>
                          {evaluation.value === null ? (
                            <span className="text-text-tertiary font-bold shrink-0">—</span>
                          ) : (
                            <span className="text-primary font-bold shrink-0">
                              {evaluation.value} / 100
                            </span>
                          )}
                        </div>
                        <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                          {evaluation.value === null ? null : (
                            <div
                              className="h-full bg-primary-container rounded-full"
                              style={{ width: `${evaluation.value}%` }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-canvas-subtle p-4 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-subtle text-orange-deep flex items-center justify-center shrink-0">
                        <Icon name="person" className="text-[20px]" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-headline-sm text-headline-sm text-text-primary block truncate">
                          Example application
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary truncate block">
                          Senior backend engineer · criteria evaluated one by one
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-success-surface text-success-text font-label-md text-label-md shrink-0 self-start sm:self-auto">
                      Scores contestable
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
