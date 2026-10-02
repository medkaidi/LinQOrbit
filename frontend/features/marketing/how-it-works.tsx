import { PageHero } from "@/features/marketing/page-hero";

const STEPS = [
  {
    title: "Create your profile",
    body: "Tell us your skills, goals and constraints once — your agents take it from there.",
  },
  {
    title: "AI agents go to work",
    body: "Your agents continuously analyze new, verified opportunities against your profile.",
  },
  {
    title: "Get matched",
    body: "Every opportunity arrives with a match score and the reasons behind it.",
  },
  {
    title: "Apply with confidence",
    body: "Track every application in one place and follow each response as it comes in.",
  },
] as const;

export function HowItWorks() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="How it works"
        title="From profile to offer in four steps"
        lede="A simple loop, powered by agents that never sleep."
      />
      <section className="max-w-7xl mx-auto px-gutter pb-space-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {STEPS.map((step, index) => (
          <article
            key={step.title}
            className="bg-surface-container-low p-space-md rounded-lg border border-slate-border"
          >
            <div className="w-10 h-10 rounded-full bg-primary-container text-canvas-white flex items-center justify-center font-label-lg text-label-lg font-bold mb-space-sm">
              {index + 1}
            </div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
              {step.title}
            </h2>
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary leading-relaxed">
              {step.body}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
