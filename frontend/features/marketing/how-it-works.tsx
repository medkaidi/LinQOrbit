import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

type Step = {
  num: string;
  icon: string;
  tag: string;
  title: string;
  body: string;
  micro: ReactNode;
};

/**
 * Le parcours réel du produit : l'offre est structurée, analysée par l'IA,
 * publiée — le screening propose alors des candidats — puis la candidature est
 * évaluée critère par critère et le recruteur tranche. Aucun agent fictif,
 * aucune télémétrie inventée.
 */
const STEPS: Step[] = [
  {
    num: "01",
    icon: "edit_note",
    tag: "Offer definition",
    title: "Write the offer",
    body: "The recruiter fills a structured offer: role, description, skills with their weights, languages, experience, education, contract, work mode, location, salary and deadline. Preselection questions can be added.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md text-text-primary font-bold">
            Weighted criteria
          </span>
          <span className="font-label-md text-label-md text-orange-deep">Two separate scales</span>
        </div>
        <div className="p-3 rounded-lg bg-canvas-white shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-label-md text-label-md text-text-primary">Mandatory</span>
            <span className="font-label-md text-label-md text-text-secondary">total 100 %</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white border border-slate-border text-text-primary">
              Java · 30 %
            </span>
            <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white border border-slate-border text-text-primary">
              Spring Boot · 25 %
            </span>
            <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white border border-slate-border text-text-primary">
              SQL · 20 %
            </span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-canvas-white shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-label-md text-label-md text-text-primary">Preferred</span>
            <span className="font-label-md text-label-md text-text-secondary">total 100 %</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white border border-slate-border text-text-primary">
              React · 40 %
            </span>
            <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white border border-slate-border text-text-primary">
              AWS · 30 %
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: "02",
    icon: "rule",
    tag: "Offer analysis",
    title: "Analyze, then publish",
    body: "The platform normalizes and analyzes the offer with AI; the recruiter publishes it once it is validated. While the analysis runs, the offer is flagged “Analyzing…”, and an offer modified afterwards is flagged “Unvalidated changes” until it is validated again.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md text-text-primary font-bold">
            Offer lifecycle
          </span>
          <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md">
            Analyzing…
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-canvas-white shadow-sm font-label-md text-label-md text-text-secondary">
            Draft
          </span>
          <Icon name="arrow_forward" className="text-text-tertiary text-[16px]" />
          <span className="px-3 py-1.5 rounded-full bg-canvas-white shadow-sm font-label-md text-label-md text-text-primary">
            Analyzing…
          </span>
          <Icon name="arrow_forward" className="text-text-tertiary text-[16px]" />
          <span className="px-3 py-1.5 rounded-full bg-canvas-white shadow-sm font-label-md text-label-md text-text-primary">
            Validated
          </span>
          <Icon name="arrow_forward" className="text-text-tertiary text-[16px]" />
          <span className="px-3 py-1.5 rounded-full bg-canvas-white shadow-sm font-label-md text-label-md text-text-primary">
            Published
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-canvas-white text-body-sm font-body-sm text-text-secondary">
          An offer changed after its validation must be validated again before being published.
        </div>
      </div>
    ),
  },
  {
    num: "03",
    icon: "person_search",
    tag: "Candidate search",
    title: "AI screening",
    body: "Once the offer is published, the platform searches for profiles that match it and suggests them to the recruiter, with a score by section. Only candidates who consented to recruiter visibility and who are looking for opportunities are suggested.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md text-text-primary font-bold">
            Suggested candidates
          </span>
          <span className="font-label-md text-label-md text-orange-deep">Score by section</span>
        </div>
        <div className="p-3 rounded-lg bg-canvas-white shadow-sm space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-surface text-blue-deep flex items-center justify-center font-bold text-label-md shrink-0">
              AL
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-label-lg text-label-lg text-text-primary truncate">
                Example candidate
              </div>
              <div className="text-body-sm font-body-sm text-text-tertiary truncate">
                Backend engineer · 5 years of experience
              </div>
            </div>
            <span className="font-label-lg text-label-lg text-blue-deep shrink-0">84 %</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-surface-container text-text-secondary font-label-md text-label-md">
              Java
            </span>
            <span className="px-2.5 py-1 rounded-full bg-surface-container text-text-secondary font-label-md text-label-md">
              Spring Boot
            </span>
            <span className="px-2.5 py-1 rounded-full bg-surface-container text-text-secondary font-label-md text-label-md">
              SQL
            </span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-canvas-white text-body-sm font-body-sm text-text-secondary">
          Visible because consent was given and the candidate is looking for opportunities.
        </div>
      </div>
    ),
  },
  {
    num: "04",
    icon: "rate_review",
    tag: "Application",
    title: "Transparent evaluation",
    body: "The candidate applies, answers the recruiter's preselection questions and can run the AI evaluation: a score per criterion, questions to clarify, and the possibility to contest a score or report a misreading. The recruiter reviews the file and accepts or rejects the application.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-label-md text-label-md text-text-secondary uppercase">
            Candidate evaluation
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-subtle">
            <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-ping motion-reduce:animate-none" />
            <span className="font-label-md text-label-md text-orange-deep">2 clarifications</span>
          </span>
        </div>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-body-sm font-body-sm text-text-secondary mb-1">
              <span>Java</span>
              <span className="font-semibold text-text-primary">95 %</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5">
              <div className="bg-primary-container h-1.5 rounded-full w-[95%]" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-body-sm font-body-sm text-text-secondary mb-1">
              <span>Experience Java</span>
              <span className="font-semibold text-text-primary">94 %</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5">
              <div className="bg-primary-container h-1.5 rounded-full w-[94%]" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Icon name="flag" className="text-text-tertiary text-[16px]" />
          <span className="text-body-sm font-body-sm text-text-secondary">
            Contests a score, or reports a misreading
          </span>
        </div>
      </div>
    ),
  },
];

const CHECKS = [
  "No subscription",
  "No credit card required",
  "Recruiter visibility is opt-in",
] as const;

export function HowItWorks() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="How The Platform Works"
        title={
          <>
            From a Job Description to a Decision, in{" "}
            <span className="text-orange-deep">Four Steps</span>
          </>
        }
        lede="How an offer becomes a shortlist, and how an application is evaluated — transparently, criterion by criterion."
      />

      <section className="max-w-7xl mx-auto px-gutter py-12 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <p className="font-label-caps text-label-caps text-orange-deep tracking-widest uppercase mb-2">
              Step-by-Step
            </p>
            <h2 className="font-display text-display-mobile lg:text-headline-lg text-text-primary tracking-tight">
              How the Recruitment Workflow Runs
            </h2>
          </div>
          <p className="font-body-md text-body-md text-text-secondary max-w-md">
            Each step works from the same normalized data and the same comparison engine — there
            is no separate algorithm per screen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {STEPS.map((step) => (
            <article
              key={step.num}
              className="bg-canvas-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-6"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display text-display text-surface-container-high leading-none select-none">
                    {step.num}
                  </span>
                  <span className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-primary-container">
                    <Icon name={step.icon} className="text-[22px]" />
                  </span>
                </div>
                <p className="font-label-caps text-label-caps text-orange-deep uppercase tracking-wider mb-2">
                  {step.tag}
                </p>
                <h3 className="font-headline-md text-headline-md text-text-primary mb-3">
                  {step.title}
                </h3>
                <p className="font-body-md text-body-md text-text-secondary">{step.body}</p>
              </div>
              {step.micro}
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-gutter pt-12 pb-24 text-center w-full">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-subtle">
            <span className="w-2 h-2 rounded-full bg-orange-vibrant" />
            <span className="font-label-caps text-label-caps text-orange-deep uppercase tracking-widest">
              Get Started
            </span>
          </div>
          <h2 className="font-display text-display-mobile lg:text-headline-lg text-text-primary tracking-tight">
            Build your profile, or publish your first offer
          </h2>
          <p className="font-body-lg text-body-lg text-text-secondary max-w-xl mx-auto">
            Create an account to complete a professional profile as a candidate, or to publish and
            review job offers as a recruiter.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-canvas-white font-label-lg text-label-lg hover:bg-orange-deep transition-all duration-150 shadow-sm flex items-center justify-center gap-2"
            >
              <span>Create your account</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-body-sm text-body-sm text-text-tertiary">
            {CHECKS.map((check) => (
              <span key={check} className="flex items-center gap-1.5">
                <Icon name="check_circle" className="text-tertiary text-[16px]" />
                {check}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
