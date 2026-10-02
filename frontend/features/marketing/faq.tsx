import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";
import { FaqExplorer } from "@/features/marketing/faq-explorer";

const FAQS = [
  {
    icon: "hub",
    question: "What is LinQOrbit?",
    answer:
      "LinQOrbit is an AI-powered recruitment platform. AI agents analyze the job market continuously and match candidates with offers — and recruiters with candidates — using transparent match scores.",
  },
  {
    icon: "groups",
    question: "Who is it for?",
    answer:
      "Both sides of the market: candidates looking for their next role, and recruiters looking for people who genuinely fit their openings.",
  },
  {
    icon: "psychology",
    question: "How does the AI matching work?",
    answer:
      "Your agents compare profiles and opportunities against real criteria — skills, location, seniority, expectations — and produce a match score together with the reasons behind it. No black boxes.",
  },
  {
    icon: "sell",
    question: "Is LinQOrbit free?",
    answer:
      "Core access will be free during the early phase. Pricing will be announced publicly before any paid plan goes live — no surprises.",
  },
  {
    icon: "rocket_launch",
    question: "When does it launch?",
    answer:
      "The platform is in active development. Create an account to follow progress and get early access.",
  },
  {
    icon: "mail",
    question: "How can I get in touch?",
    answer:
      "Write to us at contact@linqorbit.com from the Contact page — we usually reply within two business days.",
  },
] as const;

export function Faq() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Help & Answers"
        title={
          <>
            Frequently Asked <span className="text-orange-deep">Questions</span>
          </>
        }
        lede="Everything you need to know about our autonomous AI agents, candidate matching algorithms, and data practices."
      />

      <FaqExplorer faqs={FAQS} />

      <section className="max-w-5xl mx-auto w-full px-gutter py-10">
        <div className="bg-canvas-white rounded-xl shadow-sm p-8 lg:p-10">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md uppercase tracking-wider">
              Direct Assistance
            </span>
            <h2 className="mt-3 font-headline-lg text-headline-lg text-text-primary tracking-tight">
              Still have unanswered questions?
            </h2>
            <p className="mt-2 font-body-md text-body-md text-text-secondary">
              Write to us anytime — we usually reply within two business days.
            </p>
          </div>
          <div className="max-w-md mx-auto">
            <a
              href="mailto:contact@linqorbit.com"
              className="group p-5 rounded-xl bg-canvas-subtle hover:bg-orange-subtle/50 transition-all flex flex-col items-start justify-between text-left"
            >
              <div className="w-10 h-10 rounded-full bg-orange-subtle text-orange-deep flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon name="mail" className="text-[20px]" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-text-primary group-hover:text-orange-deep transition-colors">
                Email Support
              </h3>
              <p className="mt-2 font-body-sm text-body-sm text-text-secondary">
                Send us your questions about the platform, matching, or your account.
              </p>
              <div className="mt-4 flex items-center gap-1.5 font-label-lg text-label-lg text-orange-deep">
                <span>contact@linqorbit.com</span>
                <Icon
                  name="arrow_forward"
                  className="text-[16px] group-hover:translate-x-1 transition-transform"
                />
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
