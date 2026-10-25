import type { NextStep } from "@/components/ui/next-steps-card";
import { plural } from "@/lib/utils/format";
import type { ApplicationCounts, CandidateDashboard } from "@/types/application";
import type { CandidateProfile, CvAttachment, VisibilityConsent } from "@/types/candidate";

/**
 * Candidatures transmises : en attente, acceptées ou refusées. Un brouillon
 * n'est pas encore envoyé, une candidature retirée ne compte plus.
 */
export function sentApplicationCount(counts: ApplicationCounts): number {
  return counts.submitted + counts.accepted + counts.rejected;
}

export function totalApplicationCount(counts: ApplicationCounts): number {
  return sentApplicationCount(counts) + counts.draft + counts.withdrawn;
}

/** État du profil affiché dans le bandeau de la carte « Profile » (signaux du GET, jamais déduits). */
export function profileStateLabel(profile: CandidateProfile): string {
  if (profile.completionPercentage === 0) {
    return "Nothing added yet";
  }
  if (profile.normalizationInProgress) {
    return "Analysis in progress";
  }
  if (profile.normalizationFailed) {
    return "Analysis failed";
  }
  if (profile.analysisOutdated) {
    return "Re-validation needed";
  }
  return profile.hasUnvalidatedChanges ? "Changes to validate" : "Validated";
}

export function draftsLabel(drafts: number): string {
  return drafts > 0 ? `${plural(drafts, "draft")} to finish` : "No draft in progress";
}

export function invitationsLabel(invitations: number): string {
  return invitations > 0 ? "Open from recruiters" : "None waiting";
}

type NextStepsInput = {
  profile?: CandidateProfile;
  dashboard?: CandidateDashboard;
  consent?: VisibilityConsent;
  cvs?: CvAttachment[];
};

/**
 * Prochaines étapes déduites de l'état réel du candidat, dans l'ordre où elles
 * rapportent le plus : répondre aux invitations, terminer les brouillons, puis
 * soigner le profil (complétion, validation, CV, visibilité) et enfin parcourir
 * les offres. Une source encore absente (chargement, erreur) ne produit aucune
 * étape — on ne suggère jamais sur une donnée inconnue.
 */
export function nextSteps({ profile, dashboard, consent, cvs }: NextStepsInput): NextStep[] {
  const steps: NextStep[] = [];

  if (dashboard && dashboard.openInvitations > 0) {
    steps.push({
      id: "invitations",
      icon: "mail",
      title: `Answer ${plural(dashboard.openInvitations, "invitation")}`,
      detail: "Recruiters invited you to apply.",
      href: "/applications",
    });
  }
  if (dashboard && dashboard.applications.draft > 0) {
    steps.push({
      id: "drafts",
      icon: "edit_note",
      title: `Finish ${plural(dashboard.applications.draft, "draft")}`,
      detail: "Submit your application before the offer closes.",
      href: "/applications",
    });
  }
  if (profile && profile.completionPercentage < 100) {
    steps.push({
      id: "complete-profile",
      icon: "person",
      title: "Complete your profile",
      detail: `${profile.completionPercentage}% complete.`,
      href: "/profile/edit",
    });
  }
  // Rien à valider tant qu'une analyse tourne, ni sur un profil vide ou déjà validé.
  if (profile && profile.completionPercentage > 0 && !profile.normalizationInProgress) {
    const state = profileStateLabel(profile);
    if (state !== "Validated") {
      steps.push({
        id: "validate-profile",
        icon: "verified",
        title: "Validate your profile",
        detail: state,
        href: "/profile",
      });
    }
  }
  if (cvs && cvs.length === 0) {
    steps.push({
      id: "upload-cv",
      icon: "upload_file",
      title: "Upload your CV",
      detail: "You need a CV to submit an application.",
      href: "/profile/edit",
    });
  }
  if (consent && !consent.consented) {
    steps.push({
      id: "visibility",
      icon: "shield_person",
      title: "Let recruiters find you",
      detail: "Until you agree, you are never suggested to recruiters.",
      href: "/profile",
    });
  }
  if (dashboard && totalApplicationCount(dashboard.applications) === 0 && dashboard.openOffers > 0) {
    steps.push({
      id: "browse",
      icon: "work",
      title: "Browse open offers",
      detail: `${plural(dashboard.openOffers, "offer")} open right now.`,
      href: "/jobs",
    });
  }
  return steps;
}
