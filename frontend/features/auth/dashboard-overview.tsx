"use client";

import { Icon } from "@/components/ui/icon";
import { NewCampaignButton } from "@/components/ui/new-campaign-button";
import { useMounted } from "@/hooks/use-mounted";
import { useViewMode } from "@/hooks/use-view-mode";
import { useAuthStore } from "@/stores/auth-store";

const CANDIDATE_STATS = [
  {
    section: "Pipeline",
    period: "This month",
    value: "12",
    caption: "open",
    bandTitle: "Active jobs",
    bandTrend: "4 in critical demand",
    bandIcon: "add",
    bandClass: "bg-orange-deep",
  },
  {
    section: "AI sourcing",
    period: "Real-time",
    value: "348",
    caption: "qualified profiles",
    bandTitle: "AI-sourced this month",
    bandTrend: "+28% vs last month",
    bandIcon: "trending_up",
    bandClass: "bg-text-primary",
  },
  {
    section: "AI precision",
    period: "Continuous",
    value: "74.2%",
    caption: "accuracy",
    bandTitle: "AI pre-qualification rate",
    bandTrend: "Verified",
    bandIcon: "verified",
    bandClass: "bg-blue-deep",
  },
  {
    section: "Velocity",
    period: "Last 30 days",
    value: "18d",
    caption: "average cycle",
    bandTitle: "Reduced time-to-hire",
    bandTrend: "38d sector average, 52% faster",
    bandIcon: "bolt",
    bandClass: "bg-emerald-deep",
  },
] as const;

/** Métriques recruteur (données fictives, en attendant les vraies). */
const RECRUITER_STATS = [
  {
    section: "Offers",
    period: "This month",
    value: "6",
    caption: "published",
    bandTitle: "Live job offers",
    bandTrend: "2 drafts waiting for validation",
    bandIcon: "description",
    bandClass: "bg-orange-deep",
  },
  {
    section: "Applicants",
    period: "Real-time",
    value: "248",
    caption: "applications",
    bandTitle: "Received this month",
    bandTrend: "+18% vs last month",
    bandIcon: "group",
    bandClass: "bg-text-primary",
  },
  {
    section: "Match quality",
    period: "Continuous",
    value: "86%",
    caption: "average match",
    bandTitle: "AI-ranked shortlists",
    bandTrend: "Verified",
    bandIcon: "verified",
    bandClass: "bg-blue-deep",
  },
  {
    section: "Velocity",
    period: "Last 30 days",
    value: "16d",
    caption: "time-to-hire",
    bandTitle: "Fastest hire cycle",
    bandTrend: "38d sector average, 58% faster",
    bandIcon: "bolt",
    bandClass: "bg-emerald-deep",
  },
] as const;

const AGENTS = [
  {
    icon: "travel_explore",
    title: "Sourcing & semantic scraping agent",
    description:
      "Continuous scouting across LinkedIn Recruiter, GitHub, and partner CV databases.",
    focusLabel: "Current focus",
    focusValue: "Staff Software Engineer",
    metric: "42 profiles explored per hour",
  },
  {
    icon: "videocam",
    title: "Video & async screening agent",
    description:
      "Audio-linguistic synthesis, key-skill detection, and clarity scoring.",
    focusLabel: "Verbatim precision",
    focusValue: "99.1%",
    metric: "Screening summaries generated automatically",
  },
  {
    icon: "balance",
    title: "Inclusive matching agent",
    description: "Cognitive bias neutralization and objective skill weighting.",
    focusLabel: "Average match score",
    focusValue: "88%",
    metric: "Biases neutralized across 12 socio-demographic criteria",
  },
] as const;

const PIPELINE_ROWS = [
  {
    title: "Staff Software Engineer",
    badge: null,
    meta: "Engineering • Paris (Hybrid) • Full-time",
    pipeline: ["48 sourced", "14 qualified", "4 interviews", "1 offer"],
    status: "96% on track",
    statusTone: "success" as const,
    owner: "Camille V.",
  },
  {
    title: "Senior DevOps / Kubernetes",
    badge: "In high demand",
    meta: "Cloud Infrastructure • Full Remote",
    pipeline: ["19 sourced", "5 qualified", "2 interviews", "0 offers"],
    status: "Talent pool alert",
    statusTone: "warning" as const,
    owner: "Alexandre D.",
  },
  {
    title: "Lead Frontend (React/Next.js)",
    badge: null,
    meta: "Core Experience • Lyon (Hybrid)",
    pipeline: ["62 sourced", "21 qualified", "8 interviews", "2 finalists"],
    status: "98% optimal",
    statusTone: "success" as const,
    owner: "Camille V.",
  },
  {
    title: "Head of Product Growth",
    badge: null,
    meta: "Scaleup Marketing • Paris • Full-time",
    pipeline: ["34 sourced", "11 qualified", "3 interviews", "0 offers"],
    status: "91% active",
    statusTone: "success" as const,
    owner: "Sara M.",
  },
] as const;

function ownerInitials(owner: string) {
  return owner
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function DashboardOverview() {
  const user = useAuthStore((state) => state.user);
  const mounted = useMounted();
  const { mode } = useViewMode();
  const stats = mode === "recruiter" ? RECRUITER_STATS : CANDIDATE_STATS;
  const today = mounted
    ? new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const firstName = user?.firstName ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome bar */}
      <section className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="max-w-3xl">
          <p className="mb-2 text-body-sm font-body-sm text-text-secondary">
            {today ?? "\u00A0"}
          </p>
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-body-md font-body-md text-text-secondary">
            Here&apos;s what your recruiting agents are working on.
          </p>
        </div>
        <NewCampaignButton />
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Key metrics">
        {stats.map((stat) => (
          <div
            key={stat.bandTitle}
            className="bg-canvas-white border border-slate-border rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-border-strong transition-[border-color] duration-150 ease-out"
          >
            <div className="p-4 pb-3 flex flex-col flex-1">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-border">
                <span className="text-body-sm font-body-sm font-medium text-text-secondary">
                  {stat.section}
                </span>
                <span className="text-[11px] font-mono text-text-tertiary">{stat.period}</span>
              </div>
              <div className="my-auto text-center py-1">
                <div className="text-display-mobile font-display font-extrabold text-text-primary leading-none">
                  {stat.value}
                </div>
                <div className="mt-1.5 text-body-sm font-body-sm text-text-tertiary font-medium">
                  {stat.caption}
                </div>
              </div>
            </div>
            <div
              className={`px-3.5 py-2.5 text-canvas-white flex items-center justify-between mt-2 ${stat.bandClass}`}
            >
              <div className="flex flex-col text-left leading-tight">
                <span className="font-label-caps text-label-caps uppercase">
                  {stat.bandTitle}
                </span>
                <span className="text-[10px] text-canvas-white/90 font-medium">
                  {stat.bandTrend}
                </span>
              </div>
              <div className="w-5 h-5 rounded flex items-center justify-center border border-canvas-white/40 bg-canvas-white/20 shrink-0 ml-2">
                <Icon name={stat.bandIcon} className="text-[14px] text-canvas-white" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Control tower + recommendations */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
                Live AI agent control tower
              </h2>
              <p className="text-body-sm font-body-sm text-text-secondary">
                Real-time telemetry across your agents.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle">
              <span className="w-2 h-2 rounded-full bg-orange-vibrant animate-ping motion-reduce:animate-none" />
              <span className="font-label-md text-label-md text-orange-deep">3 agents live</span>
            </span>
          </div>

          {AGENTS.map((agent) => (
            <article key={agent.title} className="bg-canvas-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-orange-subtle text-orange-deep flex items-center justify-center shrink-0">
                  <Icon name={agent.icon} className="text-[20px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-headline-sm text-headline-sm text-text-primary font-bold">
                    {agent.title}
                  </h3>
                  <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
                    {agent.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-border flex flex-wrap items-center justify-between gap-2">
                <span className="text-body-sm font-body-sm text-text-secondary">
                  <span className="font-bold text-text-primary">{agent.focusLabel}:</span>{" "}
                  {agent.focusValue}
                </span>
                <span className="text-body-sm font-body-sm text-text-secondary">
                  {agent.metric}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-canvas-white rounded-2xl p-5 shadow-sm">
            <div>
              <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
                Priority AI recommendations
              </h2>
              <p className="text-body-sm font-body-sm text-text-secondary">
                Suggested actions from live scoring.
              </p>
            </div>

            <div className="mt-4 flex flex-col divide-y divide-slate-border">
              <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md">
                    <Icon name="crisis_alert" className="text-[14px]" />
                    High scoring alert
                  </span>
                  <span className="text-body-sm font-body-sm text-text-tertiary">12 min ago</span>
                </div>
                <p className="text-body-sm font-body-sm text-text-secondary">
                  Lead Frontend: a strong match was detected. Engage the interview loop.
                </p>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Coming soon"
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas-white border border-slate-border text-text-secondary font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-60"
                >
                  Engage interviews
                  <Icon name="arrow_forward" className="text-[14px]" />
                </button>
              </div>

              <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-canvas-subtle text-text-secondary font-label-md text-label-md">
                    <Icon name="inhomogeneity" className="text-[14px]" />
                    Talent pool optimization
                  </span>
                  <span className="text-body-sm font-body-sm text-text-tertiary">47 min ago</span>
                </div>
                <p className="text-body-sm font-body-sm text-text-secondary">
                  DevOps Kubernetes: consider adjusting the experience criterion or launching a
                  follow-up wave.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Coming soon"
                    className="px-3 py-1.5 rounded-full bg-canvas-white border border-slate-border text-text-secondary font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-60"
                  >
                    Adjust criteria (-1 yr)
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Coming soon"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas-white border border-slate-border text-text-secondary font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="bolt" className="text-[14px]" />
                    Launch AI follow-up
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-text-primary p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-orange-vibrant/15 text-orange-vibrant flex items-center justify-center shrink-0">
                <Icon name="insights" className="text-[18px]" />
              </span>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-canvas-white font-bold">
                  Predictive hiring audit
                </h2>
                <p className="text-body-sm font-body-sm text-slate-border">
                  All 12 open jobs forecast to close within 24 business days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline table */}
      <section className="bg-canvas-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6 py-5 border-b border-slate-border">
          <div>
            <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
              Priority open jobs
            </h2>
            <p className="text-body-sm font-body-sm text-text-secondary">
              Pipeline health and velocity across your priority jobs.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-caps text-label-caps normal-case tracking-normal">
            4 active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-border">
                <th className="px-4 lg:px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Job
                </th>
                <th className="px-4 lg:px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Pipeline
                </th>
                <th className="px-4 lg:px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Health
                </th>
                <th className="px-4 lg:px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Owner
                </th>
                <th className="px-4 lg:px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_ROWS.map((row) => (
                <tr key={row.title} className="border-b border-slate-border last:border-b-0">
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-label-lg text-label-lg text-text-primary font-bold">
                        {row.title}
                      </span>
                      {row.badge ? (
                        <span className="px-2 py-0.5 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md whitespace-nowrap">
                          {row.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-body-sm font-body-sm text-text-tertiary">{row.meta}</p>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {row.pipeline.map((step) => (
                        <span
                          key={step}
                          className="px-2 py-0.5 rounded-full bg-canvas-subtle text-text-secondary font-body-sm text-body-sm whitespace-nowrap"
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full font-label-md text-label-md whitespace-nowrap ${
                        row.statusTone === "success"
                          ? "bg-success-surface text-success-text"
                          : "bg-orange-subtle text-orange-deep"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-surface-container text-text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                        {ownerInitials(row.owner)}
                      </span>
                      <span className="text-body-sm font-body-sm text-text-primary whitespace-nowrap">
                        {row.owner}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Coming soon"
                      aria-label={`Row actions for ${row.title}`}
                      className="p-2 rounded-full text-text-tertiary cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon name="more_horiz" className="text-[18px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6 py-4 border-t border-slate-border">
          <span className="text-body-sm font-body-sm text-text-secondary">
            Showing 4 priority jobs out of 12 total
          </span>
          <span
            aria-disabled="true"
            title="Coming soon"
            className="inline-flex items-center gap-1 text-body-sm font-body-sm text-text-tertiary cursor-not-allowed select-none"
          >
            View all pipelines
            <Icon name="chevron_right" className="text-[16px]" />
          </span>
        </div>
      </section>
    </div>
  );
}
