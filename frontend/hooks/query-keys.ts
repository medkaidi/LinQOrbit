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
import type { AdminUserFilters } from "@/types/admin";
import type {
  RecruiterApplicationDirection,
  RecruiterApplicationSortValue,
  RecruiterApplicationStatusValue,
} from "@/types/application";

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  candidate: {
    profile: ["candidate", "profile"] as const,
    cvs: ["candidate", "cvs"] as const,
    /** Consentement à la visibilité recruteur (T-102, D86). */
    visibility: ["candidate", "visibility"] as const,
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
    /** Liste infinie filtrée (D34/T-48) : les filtres entrent dans la clé (le préfixe `users` invalide tout). */
    usersPage: (filters: AdminUserFilters) =>
      ["admin", "users", "page", filters] as const,
    userDetail: (userId: string) => ["admin", "users", userId] as const,
    userProfile: (userId: string) => ["admin", "users", userId, "profile"] as const,
    userNormalized: (userId: string) => ["admin", "users", userId, "normalized-profile"] as const,
    userNormalizedVersions: (userId: string) =>
      ["admin", "users", userId, "normalized-profile", "versions"] as const,
    /** Liste infinie (D34) : les pages sont implicites dans le cache TanStack. */
    jobOffersPage: (status: string | undefined) =>
      ["admin", "job-offers", status ?? "all"] as const,
    jobOfferDetail: (offerId: string) => ["admin", "job-offers", offerId] as const,
    jobOfferNormalized: (offerId: string) =>
      ["admin", "job-offers", offerId, "normalized-profile"] as const,
    jobOfferNormalizedVersions: (offerId: string) =>
      ["admin", "job-offers", offerId, "normalized-profile", "versions"] as const,
    skillSuggestions: ["admin", "skill-suggestions"] as const,
    /**
     * Signalements internes d'évaluations IA (D66) — liste infinie. L'admin
     * courant fait partie de la clé (T-99) : chaque réponse porte son propre
     * `myReviewVerdict`, jamais celui d'un autre compte.
     */
    criterionReportsPage: (adminId: string) =>
      ["admin", "criterion-reports", "page", adminId] as const,
    /**
     * Dossier d'un signalement (T-86) : détail d'une ligne de la liste.
     * L'admin courant fait partie de la clé (T-97) — `myReview` ne doit
     * jamais être relu depuis le cache d'un autre compte.
     */
    criterionReport: (reportId: string, adminId: string) =>
      ["admin", "criterion-reports", reportId, adminId] as const,
  },
  publicJobs: {
    list: ["public-jobs", "list"] as const,
    detail: (publicId: string) => ["public-jobs", publicId] as const,
    related: (publicId: string) => ["public-jobs", "related", publicId] as const,
  },
  applications: {
    mine: ["applications", "mine"] as const,
    context: (publicId: string) => ["applications", "context", publicId] as const,
  },
  recruiterApplications: {
    /** Liste d'une offre, filtrée et triée ; le préfixe permet d'invalider toutes les vues. */
    list: (
      offerId: string,
      status: RecruiterApplicationStatusValue,
      sort: RecruiterApplicationSortValue,
      direction: RecruiterApplicationDirection,
    ) => ["recruiter-applications", "list", offerId, status, sort, direction] as const,
    /** Toutes les listes d'une offre (après une décision). */
    offer: (offerId: string) => ["recruiter-applications", "list", offerId] as const,
    detail: (offerId: string, applicationId: string) =>
      ["recruiter-applications", "detail", offerId, applicationId] as const,
  },
  /** Candidats suggérés (ayant consenti) d'une offre publiée — T-101, D85 ; profil complet T-102, D86. */
  recruiterSuggestions: {
    list: (offerId: string) => ["recruiter-suggestions", offerId, "list"] as const,
    profile: (offerId: string, suggestionId: string) =>
      ["recruiter-suggestions", offerId, "profile", suggestionId] as const,
    /** Toute la famille d'une offre (liste + profils) : après une invitation. */
    offer: (offerId: string) => ["recruiter-suggestions", offerId] as const,
  },
  /** Invitations à candidater reçues par le candidat connecté — T-101, D85. */
  invitations: {
    mine: ["invitations", "mine"] as const,
  },
  matching: {
    /** Matching courant du couple pour la fiche courante du candidat (D58). */
    current: (publicId: string) => ["matching", "current", publicId] as const,
  },
} as const;
