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

const STEPS: Step[] = [
  {
    num: "01",
    icon: "tune",
    tag: "Requirement Synthesis",
    title: "Dynamic Job & Skill Trajectory Definition",
    body: "Define target stack, systems architecture constraints, and non-negotiable soft skills using plain natural language or simply ingest raw engineering job briefs.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-container" />
          <span className="font-label-md text-label-md text-text-primary">Prompt Parser Active</span>
        </div>
        <div className="p-2.5 rounded-lg bg-canvas-white text-body-sm font-body-sm text-text-secondary italic">
          &ldquo;Senior Rust Systems Engineer with experience in Raft consensus, zero-copy
          buffers, and high-frequency messaging.&rdquo;
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm">
            Rust AST
          </span>
          <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-canvas-white text-text-primary shadow-sm">
            Distributed Consensus
          </span>
          <span className="px-2.5 py-1 rounded-full text-label-md font-label-md bg-orange-subtle text-orange-deep">
            Trajectory: Staff+
          </span>
        </div>
      </div>
    ),
  },
  {
    num: "02",
    icon: "radar",
    tag: "Autonomous Discovery",
    title: "Autonomous Deep Sourcing (Agent Orion)",
    body: "Agent Orion scans global code repositories, open-source pull requests, tech RFC publications, and niche registries to detect high-fit engineers who never post on job boards.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-text-primary font-bold">
            Orion Scanner Graph
          </span>
          <span className="font-label-md text-label-md text-orange-deep">
            Scanning 14.8k PRs/sec
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-canvas-white shadow-sm text-body-sm font-body-sm">
            <span className="flex items-center gap-2 min-w-0">
              <Icon name="terminal" className="text-text-tertiary text-[18px] shrink-0" />
              <span className="font-label-lg text-label-lg text-text-primary truncate">
                github.com/tokio-rs/...
              </span>
            </span>
            <span className="text-success-text font-label-md text-label-md shrink-0">
              +42 commits verified
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-canvas-white shadow-sm text-body-sm font-body-sm">
            <span className="flex items-center gap-2 min-w-0">
              <Icon name="article" className="text-text-tertiary text-[18px] shrink-0" />
              <span className="font-label-lg text-label-lg text-text-primary truncate">
                arXiv: Distributed Log Compaction
              </span>
            </span>
            <span className="text-orange-deep font-label-md text-label-md shrink-0">
              Lead Author
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: "03",
    icon: "analytics",
    tag: "Technical Vetting",
    title: "Technical Audit & Predictive Scoring (Agent Vega)",
    body: "Agent Vega constructs an AST graph of actual public commits, measures cyclomatic complexity tolerances, and assigns an unyielding, objective 0-100% Match Index score.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="font-label-md text-label-md text-text-secondary uppercase">
            Candidate Dossier Index
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-subtle">
            <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-ping motion-reduce:animate-none" />
            <span className="font-headline-sm text-headline-sm text-orange-deep font-bold">
              97% AI Match
            </span>
          </span>
        </div>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-body-sm font-body-sm text-text-secondary mb-1">
              <span>Concurrency &amp; Memory Safety</span>
              <span className="font-semibold text-text-primary">99%</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5">
              <div className="bg-primary-container h-1.5 rounded-full w-[99%]" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-body-sm font-body-sm text-text-secondary mb-1">
              <span>Architecture Scalability</span>
              <span className="font-semibold text-text-primary">94%</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5">
              <div className="bg-tertiary-container h-1.5 rounded-full w-[94%]" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    num: "04",
    icon: "send",
    tag: "High-Conversion Outreach",
    title: "Seamless Outreach & Executive Introductions (Agent Hermes)",
    body: "Agent Hermes synthesizes custom outreach referencing genuine technical milestones, syncs team calendar availability, and routes confirmed conversations into your Kanban pipeline.",
    micro: (
      <div className="p-4 rounded-xl bg-canvas-subtle space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label-md text-label-md text-text-primary">
            Status: Conversational Handshake
          </span>
          <span className="px-2.5 py-0.5 rounded-full font-label-md text-label-md bg-success-surface text-success-text">
            Calendar Synced
          </span>
        </div>
        <div className="p-3 rounded-lg bg-canvas-white shadow-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-orange-deep font-bold text-label-md shrink-0">
            AH
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-label-lg text-label-lg text-text-primary truncate">
              Introduction sent to Alex Morgan
            </div>
            <div className="text-body-sm font-body-sm text-text-tertiary">
              30m Technical Sync scheduled for Thursday 2:00 PM
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

const CHECKS = ["30-day full access", "ATS integration ready", "Cancel anytime"] as const;

export function HowItWorks() {
  return (
    <div className="w-full bg-canvas-white">
      <PageHero
        eyebrow="The Autonomous Agent Workflow"
        title={
          <>
            From Talent Sourcing to Day One in{" "}
            <span className="text-orange-deep">Four Intelligent Steps</span>
          </>
        }
        lede="Discover how LinQOrbit replaces weeks of manual screening with algorithmic precision, verifiable code audits, and autonomous multi-agent coordination."
      />

      <section className="max-w-7xl mx-auto px-gutter py-12 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <p className="font-label-caps text-label-caps text-orange-deep tracking-widest uppercase mb-2">
              Step-by-Step Trajectory
            </p>
            <h2 className="font-display text-display-mobile lg:text-headline-lg text-text-primary tracking-tight">
              How Multi-Agent Sourcing Operates
            </h2>
          </div>
          <p className="font-body-md text-body-md text-text-secondary max-w-md">
            LinQOrbit deploys dedicated autonomous micro-agents tailored to each phase of technical
            talent evaluation.
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
              Get Started in 5 Minutes
            </span>
          </div>
          <h2 className="font-display text-display-mobile lg:text-headline-lg text-text-primary tracking-tight">
            Ready to accelerate your hiring velocity?
          </h2>
          <p className="font-body-lg text-body-lg text-text-secondary max-w-xl mx-auto">
            Join hundreds of high-growth technical leaders who have made obsolete manual
            recruitment agencies. No credit card required.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-canvas-white font-label-lg text-label-lg hover:bg-orange-deep transition-all duration-150 shadow-sm flex items-center justify-center gap-2"
            >
              <span>Start Free 30-Day Trial</span>
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
