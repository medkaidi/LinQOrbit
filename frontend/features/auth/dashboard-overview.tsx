"use client";

import { Icon } from "@/components/ui/icon";
import { useMounted } from "@/hooks/use-mounted";
import { useAuthStore } from "@/stores/auth-store";

const STATS = [
  {
    label: "Active jobs",
    value: "12",
    caption: "open",
    icon: "business_center",
    trendIcon: "priority_high",
    trend: "4 in critical demand",
  },
  {
    label: "AI-sourced this month",
    value: "348",
    caption: "qualified profiles",
    icon: "psychology",
    trendIcon: "trending_up",
    trend: "+28% vs last month",
  },
  {
    label: "AI pre-qualification rate",
    value: "74.2%",
    caption: "accuracy",
    icon: "verified",
    trendIcon: "task_alt",
    trend: "Verified",
  },
  {
    label: "Reduced time-to-hire",
    value: "18d",
    caption: "average cycle",
    icon: "schedule",
    trendIcon: "speed",
    trend: "38d sector average, 52% faster",
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
    metricIcon: "bolt",
    metric: "42 profiles explored per hour",
  },
  {
    icon: "videocam",
    title: "Video & async screening agent",
    description:
      "Audio-linguistic synthesis, key-skill detection, and clarity scoring.",
    focusLabel: "Verbatim precision",
    focusValue: "99.1%",
    metricIcon: "task_alt",
    metric: "Screening summaries generated automatically",
  },
  {
    icon: "balance",
    title: "Inclusive matching agent",
    description: "Cognitive bias neutralization and objective skill weighting.",
    focusLabel: "Average match score",
    focusValue: "88%",
    metricIcon: "balance",
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
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md">
              <Icon name="calendar_today" className="text-[14px]" />
              {today ?? "\u00A0"}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary font-bold tracking-tight">
            Welcome back, {firstName} — here&apos;s what your recruiting agents are working on
          </h1>
          <p className="mt-2 text-body-md font-body-md text-text-secondary">
            Oversee predictive pipelines, the active talent pool, and multi-agent orchestration
            in one place.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-canvas-white border border-slate-border text-text-primary font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="auto_awesome" className="text-[16px] text-orange-deep" />
            Daily AI brief
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-vibrant border border-orange-vibrant text-canvas-white font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-70"
          >
            <Icon name="rocket_launch" className="text-[16px]" />
            New campaign
          </button>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Key metrics">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-canvas-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-body-sm font-body-sm text-text-secondary">{stat.label}</span>
              <span className="w-9 h-9 rounded-xl bg-orange-subtle text-orange-deep flex items-center justify-center shrink-0">
                <Icon name={stat.icon} className="text-[18px]" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                {stat.value}
              </span>
              <span className="text-body-sm font-body-sm text-text-tertiary">{stat.caption}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-body-sm font-body-sm text-text-secondary">
              <Icon name={stat.trendIcon} className="text-[16px] text-orange-deep" />
              <span>{stat.trend}</span>
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
                Real-time telemetry and inference throughput across your agents.
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
              <div className="mt-3 rounded-xl bg-canvas-subtle p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-body-sm font-body-sm text-text-secondary">
                  <span className="font-bold text-text-primary">{agent.focusLabel}:</span>{" "}
                  {agent.focusValue}
                </span>
                <span className="inline-flex items-center gap-1.5 text-body-sm font-body-sm text-orange-deep">
                  <Icon name={agent.metricIcon} className="text-[16px]" />
                  {agent.metric}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-canvas-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
                Priority AI recommendations
              </h2>
              <p className="text-body-sm font-body-sm text-text-secondary">
                Actions your agents suggest based on live scoring.
              </p>
            </div>

            <div className="rounded-xl bg-canvas-subtle p-4 flex flex-col gap-2">
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
                className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-vibrant text-canvas-white font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-70"
              >
                Engage interviews
                <Icon name="arrow_forward" className="text-[14px]" />
              </button>
            </div>

            <div className="rounded-xl bg-canvas-subtle p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-subtle text-orange-deep font-label-md text-label-md">
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
                  className="px-3 py-1.5 rounded-full bg-canvas-white border border-slate-border text-text-primary font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-60"
                >
                  Adjust criteria (-1 yr)
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Coming soon"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-vibrant text-canvas-white font-bold text-xs shadow-sm cursor-not-allowed disabled:opacity-70"
                >
                  <Icon name="bolt" className="text-[14px]" />
                  Launch AI follow-up
                </button>
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-border">
          <div>
            <h2 className="font-headline-md text-headline-md text-text-primary font-bold">
              Priority open jobs
            </h2>
            <p className="text-body-sm font-body-sm text-text-secondary">
              Matrix view of the automated pipeline and agent velocity.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-orange-subtle text-orange-deep font-label-caps text-label-caps uppercase tracking-wider">
            4 active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-border">
                <th className="px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Job
                </th>
                <th className="px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Pipeline
                </th>
                <th className="px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Health
                </th>
                <th className="px-6 py-3 font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary">
                  Owner
                </th>
                <th className="px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_ROWS.map((row) => (
                <tr key={row.title} className="border-b border-slate-border last:border-b-0">
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-surface-container text-text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                        {ownerInitials(row.owner)}
                      </span>
                      <span className="text-body-sm font-body-sm text-text-primary whitespace-nowrap">
                        {row.owner}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Coming soon"
                      aria-label={`Row actions for ${row.title}`}
                      className="p-2 rounded-full text-text-tertiary hover:bg-canvas-subtle cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon name="more_horiz" className="text-[18px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-slate-border">
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
