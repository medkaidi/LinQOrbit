import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

const VALUES = [
  {
    icon: "visibility",
    title: "People over pipelines",
    body: "Technology should widen access to opportunity, not filter humans out of it.",
  },
  {
    icon: "auto_awesome",
    title: "Signal over noise",
    body: "Agents read the market so you only see opportunities that actually match.",
  },
  {
    icon: "verified",
    title: "Honest by default",
    body: "Every match score comes with the reasons behind it — no black boxes.",
  },
] as const;

export function About() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="About us"
        title="Career intelligence, built for people"
        lede="LinQOrbit pairs candidates and recruiters with AI agents that read the market continuously — so the right opportunities find each other."
      />
      <section className="max-w-3xl mx-auto px-gutter py-space-md text-left space-y-4">
        <p className="text-text-secondary font-body-lg text-body-lg leading-relaxed">
          Job hunting and hiring are broken by noise: hundreds of irrelevant listings, manual
          screening, slow feedback loops on both sides.
        </p>
        <p className="text-text-secondary font-body-lg text-body-lg leading-relaxed">
          LinQOrbit replaces that noise with agents that watch the market for you, score every
          opportunity against real criteria, and explain every match. Candidates see fewer, better
          options. Recruiters meet people who genuinely fit.
        </p>
      </section>
      <section className="max-w-7xl mx-auto px-gutter pb-space-xl grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {VALUES.map((value) => (
          <article
            key={value.title}
            className="bg-surface-container-low p-space-md rounded-lg border border-slate-border"
          >
            <div className="w-10 h-10 rounded-full bg-orange-subtle flex items-center justify-center text-orange-deep mb-space-sm">
              <Icon name={value.icon} className="text-[22px]" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">
              {value.title}
            </h2>
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary leading-relaxed">
              {value.body}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
