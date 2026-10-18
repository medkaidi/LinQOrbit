/** Statut de l'analyse d'un matching (miroir de l'enum backend `MatchingJobStatus`, D51). */
export type MatchingStatus = "pending" | "running" | "done" | "failed";

/** Sections du matching (D58), jamais mélangées — ordre d'affichage décidé par le backend. */
export type MatchingSectionKey =
  | "required_skills"
  | "preferred_skills"
  | "languages"
  | "experience"
  | "education";

/** Critère vu par le candidat : clé stable, libellé et score 0-100 — rien d'autre (D58). */
export type MatchingCriterion = {
  key: string;
  label: string;
  score: number;
};

export type MatchingSection = {
  section: MatchingSectionKey;
  criteria: MatchingCriterion[];
};

/** Événement SSE « status » (D60) : un signal seulement, le résultat se relit par le GET. */
export type MatchingStatusEvent = {
  matchingId: string;
  status: MatchingStatus;
};

/**
 * Matching du candidat pour une offre (D58) : `sections` est vide tant que
 * l'analyse n'est pas terminée. Ni poids, ni score de section, ni
 * justification — réservés au recruteur.
 */
export type Matching = {
  matchingId: string;
  status: MatchingStatus;
  sections: MatchingSection[];
};
