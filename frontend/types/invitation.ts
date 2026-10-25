import type { ApplicationJobSummary } from "@/types/application";
import type { CandidateProfile } from "@/types/candidate";
import type { SeniorityValue } from "@/types/recruiter";

/**
 * Statut du screening d'une offre (T-101, D85) : celui du dernier job. Le flux
 * SSE ajoute `none` (aucun screening demandé) ; `pending` et `running` seuls
 * gardent le flux ouvert.
 */
export type ScreeningStatus = "pending" | "running" | "done" | "failed" | "none";

/**
 * Signal d'affichage du screening porté par l'offre (détail et liste) et par
 * l'événement SSE. `candidateCount` est null tant que le job n'est pas `done`.
 * Le GET de l'offre reste la source de vérité ; `null` = aucun screening.
 */
export type ScreeningSignal = {
  status: ScreeningStatus;
  candidateCount: number | null;
};

/** Événement « status » du flux de screening : un signal, l'offre se relit par son GET. */
export type ScreeningStatusEvent = ScreeningSignal;

/** Statut d'une suggestion ; `applied` est dérivé de la candidature du candidat. */
export type SuggestionStatus = "suggested" | "invited" | "applied";

/** Compétence affichée sur une carte de candidat suggéré (niveau déclaré 1–5, null si inconnu). */
export type SuggestedSkill = {
  name: string;
  level: number | null;
};

/**
 * Carte d'un candidat suggéré (T-101, D85 ; identité T-102, D86) : le candidat a
 * consenti à la visibilité de son profil complet, la carte porte donc son nom.
 * L'`id` est celui de la ligne propre à l'offre (jamais l'id du candidat) ;
 * jamais d'e-mail ni de téléphone.
 */
export type SuggestedCandidate = {
  id: string;
  rank: number;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  seniority: SeniorityValue | null;
  yearsOfExperience: number | null;
  country: string | null;
  skills: SuggestedSkill[];
  status: SuggestionStatus;
};

/** Candidats suggérés d'une offre ; `canInvite` est calculé par le serveur. */
export type SuggestedCandidates = {
  canInvite: boolean;
  items: SuggestedCandidate[];
};

/**
 * Profil complet d'un candidat suggéré (T-102, D86) : carte, localisation du
 * compte et profil professionnel. Jamais d'e-mail ni de téléphone dans cette
 * réponse ; `canInvite` est calculé par le serveur.
 */
export type SuggestedCandidateProfile = {
  card: SuggestedCandidate;
  currentCity: string | null;
  currentCountry: string | null;
  canInvite: boolean;
  profile: CandidateProfile;
};

/** Invitation à candidater reçue par le candidat connecté. */
export type CandidateInvitation = {
  id: string;
  invitedAt: string;
  job: ApplicationJobSummary;
};
