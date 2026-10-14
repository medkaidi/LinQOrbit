/**
 * Registre central des clés TanStack Query — le **seul** endroit où une clé
 * est écrite. Les hooks et features consomment `queryKeys.<domain>…` ; un
 * littéral `queryKey: [...]` hors de ce fichier est une erreur.
 *
 * - Clé statique = tableau `as const` (ex. `queryKeys.auth.me`).
 * - Clé paramétrée = fabrique (ex. `queryKeys.jobOffers.detail(offerId)`),
 *   y compris pour les sous-clés simples (`queryKeys.publicJobs.detail(id)`).
 * - Invalider une famille = la clé racine de cette famille
 *   (`queryKeys.candidate.reference` rafraîchit les 4 listes de référence).
 */
export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  candidate: {
    profile: ["candidate", "profile"] as const,
    reference: ["candidate", "reference"] as const,
    referenceSkills: ["candidate", "reference", "skills"] as const,
    referenceLanguages: ["candidate", "reference", "languages"] as const,
    referenceDegrees: ["candidate", "reference", "degrees"] as const,
    referenceStudyFields: ["candidate", "reference", "study-fields"] as const,
  },
  recruiter: {
    profile: ["recruiter", "profile"] as const,
    companies: ["recruiter", "companies"] as const,
  },
  jobOffers: {
    list: ["job-offers", "list"] as const,
    detail: (offerId: string) => ["job-offers", "detail", offerId] as const,
    reference: ["job-offers", "reference"] as const,
    contractTypes: ["job-offers", "reference", "contract-types"] as const,
    employmentTypes: ["job-offers", "reference", "employment-types"] as const,
    workModes: ["job-offers", "reference", "work-modes"] as const,
  },
  admin: {
    users: ["admin", "users"] as const,
    userDetail: (userId: string) => ["admin", "users", userId] as const,
    userNormalized: (userId: string) => ["admin", "users", userId, "normalized-profile"] as const,
    jobOffers: ["admin", "job-offers"] as const,
    /** Liste infinie (D34) : les pages sont implicites dans le cache TanStack. */
    jobOffersPage: (status: string | undefined) =>
      ["admin", "job-offers", status ?? "all"] as const,
    jobOfferDetail: (offerId: string) => ["admin", "job-offers", offerId] as const,
    jobOfferNormalized: (offerId: string) =>
      ["admin", "job-offers", offerId, "normalized-profile"] as const,
    skillSuggestions: ["admin", "skill-suggestions"] as const,
  },
  publicJobs: {
    detail: (publicId: string) => ["public-jobs", publicId] as const,
  },
} as const;
