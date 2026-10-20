/**
 * Statut poussé par le flux SSE de normalisation (D64) : celui du dernier job
 * de la ressource — `none` quand elle n'a jamais été validée. Seuls `pending`
 * et `running` gardent le flux ouvert.
 */
export type NormalizationStatus = "pending" | "running" | "done" | "failed" | "none";

/** Événement « status » du flux : un signal seulement, la ressource se relit par son GET. */
export type NormalizationStatusEvent = {
  status: NormalizationStatus;
};

/** Ressource suivie : le profil du candidat connecté, ou une offre de ses companies. */
export type NormalizationTarget = { kind: "candidate" } | { kind: "offer"; offerId: string };
