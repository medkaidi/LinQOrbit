import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

const FAQS = [
  {
    question: "What is LinQOrbit?",
    answer:
      "LinQOrbit is an AI-powered recruitment platform. AI agents analyze the job market continuously and match candidates with offers — and recruiters with candidates — using transparent match scores.",
  },
  {
    question: "Who is it for?",
    answer:
      "Both sides of the market: candidates looking for their next role, and recruiters looking for people who genuinely fit their openings.",
  },
  {
    question: "How does the AI matching work?",
    answer:
      "Your agents compare profiles and opportunities against real criteria — skills, location, seniority, expectations — and produce a match score together with the reasons behind it. No black boxes.",
  },
  {
    question: "Is LinQOrbit free?",
    answer:
      "Core access will be free during the early phase. Pricing will be announced publicly before any paid plan goes live — no surprises.",
  },
  {
    question: "When does it launch?",
    answer:
      "The platform is in active development. Create an account to follow progress and get early access.",
  },
  {
    question: "How can I get in touch?",
    answer:
      "Write to us at contact@linqorbit.com from the Contact page — we usually reply within two business days.",
  },
] as const;

export function Faq() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered"
        lede="Everything you might want to know before jumping in."
      />
      <section className="max-w-3xl mx-auto px-gutter pb-space-xl">
        {FAQS.map((item) => (
          <details key={item.question} className="group border-b border-slate-border py-space-md">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-headline-sm text-headline-sm text-text-primary">
              {item.question}
              <Icon
                name="keyboard_arrow_down"
                className="text-text-tertiary transition-transform group-open:rotate-180 shrink-0"
              />
            </summary>
            <p className="mt-2 text-text-secondary font-body-md text-body-md leading-relaxed">
              {item.answer}
            </p>
          </details>
        ))}
      </section>
    </div>
  );
}
