import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PageHero } from "@/features/marketing/page-hero";

const PILLARS = [
  {
    icon: "center_focus_strong",
    num: "Pillar 01",
    title: "Precision over Volume",
    body: "Deep semantic code and skill architecture analysis rather than basic keyword scanning. We measure production velocity, repo commit depth, and architectural scalability.",
    tag: "Semantic Verification",
  },
  {
    icon: "balance",
    num: "Pillar 02",
    title: "Unbiased Intelligence",
    body: "Anonymized initial screening that evaluates pure merit and trajectory. Identifying exceptional talent regardless of background, pedigree, or zip code.",
    tag: "Pedigree-Blind Vectors",
  },
  {
    icon: "travel_explore",
    num: "Pillar 03",
    title: "Continuous Sourcing Velocity",
    body: "Autonomous agents (Orion, Vega, Nova, Hermes) working 24/7 across GitHub, technical papers, arXiv releases, and global repositories to discover passive masters.",
    tag: "24/7 Agent Telemetry",
  },
  {
    icon: "handshake",
    num: "Pillar 04",
    title: "Human in the Orbit",
    body: "AI generates multi-layered dossier telemetry; hiring managers and founders make the final decisions. We amplify human judgment, never replace it.",
    tag: "Augmented Decision Making",
  },
] as const;

const SCORES = [
  { label: "Distributed Systems Mastery", value: 96 },
  { label: "Production Latency Optimization", value: 94 },
  { label: "Leadership Velocity & Mentorship", value: 89 },
  { label: "Algorithmic Innovation Index", value: 98 },
] as const;

const CAPABILITIES = [
  {
    icon: "insights",
    title: "Velocity Vectors",
    body: "Calculates compound skill acceleration across open source contributions and production codebases.",
  },
  {
    icon: "hub",
    title: "Cultural Gravity Matching",
    body: "Evaluates alignment with high-speed autonomous engineering organizations.",
  },
] as const;

export function About() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="Our Mission & Vision"
        title={
          <>
            Aligning Exceptional Talents with{" "}
            <span className="text-primary-container">Transformative</span> Trajectories
          </>
        }
        lede="LinQOrbit was founded on a simple premise: traditional hiring is broken by noise, bias, and latency. We build autonomous AI agents that analyze real engineering depth and cultural velocity."
        actions={
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg transition-colors duration-150"
          >
            Book Enterprise Demo
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
                Architected to Eliminate Friction and Subconscious Bias
              </h2>
            </div>
            <p className="font-body-md text-body-md text-text-secondary max-w-md">
              Every layer of LinQOrbit is designed with mathematical integrity, prioritizing
              tangible execution over superficial pedigree.
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
                  Orion Engine
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Multidimensional Talent Trajectory Modeling
                </h2>
                <p className="font-body-md text-body-md text-text-secondary">
                  Unlike legacy keyword scanners that score resumes by keyword frequency,
                  LinQOrbit models career trajectories like orbital flight paths. We predict
                  future capability growth over a 3-year horizon.
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
                      <span className="w-3 h-3 rounded-full bg-tertiary-container animate-pulse motion-reduce:animate-none shrink-0" />
                      <div className="min-w-0">
                        <div className="font-headline-sm text-headline-sm text-text-primary truncate">
                          Autonomous Agent Cluster: Orion
                        </div>
                        <div className="font-body-sm text-body-sm text-text-tertiary truncate">
                          Real-time repository graph analysis
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md shrink-0">
                      98.7% Vector Match
                    </span>
                  </div>

                  <div className="space-y-5">
                    {SCORES.map((score) => (
                      <div key={score.label}>
                        <div className="flex justify-between font-label-md text-label-md mb-2 gap-3">
                          <span className="text-text-primary">{score.label}</span>
                          <span className="text-primary font-bold shrink-0">
                            {score.value} / 100
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-container rounded-full"
                            style={{ width: `${score.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-canvas-subtle p-4 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center font-bold text-on-primary-fixed shrink-0">
                        LX
                      </div>
                      <div className="min-w-0">
                        <span className="font-headline-sm text-headline-sm text-text-primary block truncate">
                          Candidate #8492-Orbit
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary truncate block">
                          Current trajectory: Principal Staff Architect
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-success-surface text-success-text font-label-md text-label-md shrink-0 self-start sm:self-auto">
                      Verified Fit
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
