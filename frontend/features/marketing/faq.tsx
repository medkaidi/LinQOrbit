import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";
import { FaqExplorer } from "@/features/marketing/faq-explorer";

/**
 * Les réponses ne décrivent que des faits implémentés (SPEC §1, §7, §8, §10,
 * §11) : pas d'agent autonome, pas de promesse de prix, pas de délai de
 * réponse promis.
 */
const FAQS = [
  {
    icon: "hub",
    question: "What is LinQOrbit?",
    answer:
      "LinQOrbit is a recruitment platform that structures, analyses and matches job offers and candidate profiles with AI. Profiles and offers are normalized into a structured sheet, then compared criterion by criterion. The recruiter makes the final decision.",
  },
  {
    icon: "groups",
    question: "Who is it for?",
    answer:
      "Both sides of the market: candidates building a professional profile and looking for their next role, and recruiters publishing offers and reviewing applications. The same comparison engine serves both.",
  },
  {
    icon: "psychology",
    question: "How does the AI matching work?",
    answer:
      "An offer is broken into weighted criteria — mandatory and preferred, weighted separately. The platform compares each criterion with the profile, including semantic comparison (a profile mentioning PostgreSQL can match a requirement written as “relational databases”). Scores are computed criterion by criterion, and the candidate sees each of them.",
  },
  {
    icon: "rule",
    question: "What does the AI not do?",
    answer:
      "It does not read your code, scan GitHub or build a profile from public repositories. LinQOrbit works from the information you enter in your profile, and from your CV if you choose to import it. It also does not decide: a recruiter accepts or rejects an application.",
  },
  {
    icon: "shield",
    question: "Who can see my profile?",
    answer:
      "Recruiter visibility is opt-in: you give your consent from your profile, and you can withdraw it at any time. Candidates who are not looking for opportunities are not suggested to recruiters either.",
  },
  {
    icon: "sell",
    question: "Is LinQOrbit free?",
    answer:
      "Access is free: there is no subscription, no paid plan, and no card is ever collected. A recruiter account publishes offers and reviews applications; a candidate account builds a profile and applies.",
  },
  {
    icon: "rocket_launch",
    question: "Is LinQOrbit available now?",
    answer:
      "Yes. You can create an account, complete a professional profile, publish a job offer and apply to one. Some features are still being developed.",
  },
  {
    icon: "mail",
    question: "How can I get in touch?",
    answer:
      "Write to contact@linqorbit.com — the Contact page also offers a form to describe your needs and your company context.",
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
        lede="What LinQOrbit does, what the AI does and does not do, and the practicalities of using the platform."
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
              Write to us about the platform, matching, or your account.
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
