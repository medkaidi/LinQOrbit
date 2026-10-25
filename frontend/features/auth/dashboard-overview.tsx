"use client";

import { NavPill } from "@/components/ui/nav-pill";
import { CandidateDashboard } from "@/features/candidate/candidate-dashboard";
import { RecruiterDashboard } from "@/features/recruiter/recruiter-dashboard";
import { useMounted } from "@/hooks/use-mounted";
import { useRecruiterReady } from "@/hooks/use-recruiter-ready";
import { useViewMode } from "@/hooks/use-view-mode";
import { useAuthStore } from "@/stores/auth-store";

/**
 * CTA du bandeau en mode recruteur : « New offer » seulement quand le profil recruteur et une
 * société existent (le parcours de création les exige). Sinon rien — le tableau de bord ne
 * parle pas de l'amorçage du compte.
 */
function RecruiterWelcomeAction() {
  const { ready } = useRecruiterReady();
  return ready ? <NavPill icon="add" label="New offer" href="/recruiter/offers/new" /> : null;
}

export function DashboardOverview() {
  const user = useAuthStore((state) => state.user);
  const mounted = useMounted();
  const { mode } = useViewMode();
  const isRecruiter = mode === "recruiter";
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
            {today ?? " "}
          </p>
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-body-md font-body-md text-text-secondary">
            {isRecruiter
              ? "Here's where your hiring stands."
              : "Here's where your job search stands."}
          </p>
        </div>
        {isRecruiter ? (
          <RecruiterWelcomeAction />
        ) : (
          <NavPill icon="work" label="Browse offers" href="/jobs" />
        )}
      </section>

      {isRecruiter ? <RecruiterDashboard /> : <CandidateDashboard />}
    </div>
  );
}
