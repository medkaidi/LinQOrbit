import type { NextStep } from "@/components/ui/next-steps-card";
import type { AdminDashboard } from "@/types/admin";

/** Ordre des statuts de compte, tel que « Accounts by status » le déroule. */
export const ACCOUNT_STATUS_ORDER = ["active", "inactive", "suspended"] as const;

export function totalAccountCount(accounts: AdminDashboard["accounts"]): number {
  return ACCOUNT_STATUS_ORDER.reduce((total, status) => total + accounts[status], 0);
}

/** Files de traitement IA, dans l'ordre où la carte « AI processing failures » les déroule. */
export const PROCESSING_QUEUES = [
  { key: "candidateAnalyses", label: "Candidate profile analysis" },
  { key: "offerAnalyses", label: "Job offer analysis" },
  { key: "embeddings", label: "Profile embeddings" },
  { key: "screenings", label: "Candidate screening" },
  { key: "matchings", label: "Match analysis" },
] as const satisfies ReadonlyArray<{ key: keyof AdminDashboard["processingFailures"]; label: string }>;

export function totalProcessingFailures(failures: AdminDashboard["processingFailures"]): number {
  return PROCESSING_QUEUES.reduce((total, queue) => total + failures[queue.key], 0);
}

/** Total en texte muet de la carte : « None » (rien en échec) ou « 3 failed ». */
export function processingSummary(failures: AdminDashboard["processingFailures"]): string {
  const total = totalProcessingFailures(failures);
  return total === 0 ? "None failed" : `${total} failed`;
}

/** « 1 candidate », « 3 candidates », « 0 candidates » : le zéro prend le pluriel. */
function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** Fraîcheur d'une carte : ce qui est arrivé sur les 7 derniers jours. */
export function newThisWeekLabel(value: number): string {
  return `+${value} this week`;
}

/** Bande de la carte « Accounts » : les deux identités (cumulables — jamais additionnées). */
export function identitiesLabel(accounts: AdminDashboard["accounts"]): string {
  return `${count(accounts.candidates, "candidate")} · ${count(accounts.recruiters, "recruiter")}`;
}

/** Bande de la carte « Live offers » : le parc d'offres, avec ce qui reste en brouillon. */
export function liveOffersLabel(offers: AdminDashboard["offers"]): string {
  const total = offers.draft + offers.validated + offers.published + offers.closed;
  return `${total} in total · ${count(offers.draft, "draft")}`;
}

/** Bande de la carte « Applications » : les décisions déjà prises. */
export function decisionsLabel(applications: AdminDashboard["applications"]): string {
  return `${applications.accepted} accepted · ${applications.rejected} rejected`;
}

/** Valeur de la carte « To moderate » : tout ce qui attend cet admin, suggestions et signalements. */
export function moderationTotal(moderation: AdminDashboard["moderation"]): number {
  return moderation.skillSuggestions + moderation.reportsAwaitingMyReview;
}

/** Bande de la carte « To moderate ». */
export function moderationLabel(moderation: AdminDashboard["moderation"]): string {
  return `${count(moderation.skillSuggestions, "suggestion")} · ${count(moderation.reportsAwaitingMyReview, "AI report")}`;
}

/**
 * Ce qui attend cet admin, déduit de l'état réel : les suggestions de compétences d'abord (elles
 * bloquent le catalogue des candidats), puis les signalements IA qu'il peut relire. Rien à relire,
 * aucune étape.
 */
export function attentionSteps(moderation: AdminDashboard["moderation"]): NextStep[] {
  const steps: NextStep[] = [];
  if (moderation.skillSuggestions > 0) {
    steps.push({
      id: "skill-suggestions",
      icon: "lightbulb",
      title: `Review ${count(moderation.skillSuggestions, "skill suggestion")}`,
      detail: "Candidates proposed skills missing from the catalogue.",
      href: "/admin/accounts",
    });
  }
  if (moderation.reportsAwaitingMyReview > 0) {
    steps.push({
      id: "ai-reports",
      icon: "flag",
      title: `Review ${count(moderation.reportsAwaitingMyReview, "AI report")}`,
      detail: "Recruiters flagged criterion scores you have not reviewed yet.",
      href: "/admin/reports",
    });
  }
  return steps;
}
