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
 * Question de clarification IA **ouverte** (T-62) : une seule à la fois.
 * `rationale` dit au candidat pourquoi la question est posée (texte candidat,
 * jamais la justification de l'évaluation) ; `remainingQuestions` = questions
 * qui pourront encore être posées **après** celle-ci (0 = dernière).
 */
export type MatchingClarification = {
  id: string;
  question: string;
  rationale: string;
  remainingQuestions: number;
};

/** Contestation d'un critère par le candidat (T-63) : son propre score 0-100 et un commentaire facultatif. */
export type MatchingFeedbackItem = {
  criterionKey: string;
  selfValue: number;
  comment: string | null;
};

/**
 * Matching du candidat pour une offre (D58) : `sections` porte les scores du
 * **dernier résultat terminé** — vide seulement avant la toute première
 * analyse, conservé pendant une réévaluation (T-62). Ni poids, ni score de
 * section, ni justification — réservés au recruteur.
 */
export type Matching = {
  matchingId: string;
  status: MatchingStatus;
  sections: MatchingSection[];
  /** Évaluation close (plafond atteint, agent sans question ou « Finish ») : plus aucune question. */
  assessmentFinished: boolean;
  clarification: MatchingClarification | null;
  /** Contestations du candidat sur le dernier résultat (vide sinon). */
  feedback: MatchingFeedbackItem[];
};

/** Corps de `PUT …/feedback` : remplacement complet (critère absent = supprimé, `[]` efface tout). */
export type SaveMatchingFeedbackRequest = {
  items: MatchingFeedbackItem[];
};

export type MatchingFeedbackResponse = {
  items: MatchingFeedbackItem[];
};
