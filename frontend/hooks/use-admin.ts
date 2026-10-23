"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";

import {
  approveSkillSuggestion,
  createCriterionReportReview,
  getAdminJobOffer,
  getAdminUserProfile,
  getCriterionReport,
  getOfferNormalizedProfile,
  getOfferNormalizedProfileVersions,
  getUserDetail,
  getUserNormalizedProfile,
  getUserNormalizedProfileVersions,
  linkSkillSuggestion,
  listAllJobOffers,
  listCriterionReports,
  listSkillSuggestions,
  listUsers,
  rejectSkillSuggestion,
  updateUserStatus,
} from "@/lib/api/admin.api";
import type {
  AdminCriterionReportDetail,
  AdminCriterionReportReviewPayload,
  AdminJobOfferStatus,
  AdminUser,
  AdminUserFilters,
} from "@/types/admin";
import { queryKeys } from "@/hooks/query-keys";
import { nextPageParam } from "@/lib/utils/pagination";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Liste des comptes (D34) en infinite scroll, filtrable (T-48) : recherche
 * nom/email, statut et capacité — la taille de page reste décidée par le
 * backend (jamais envoyée).
 */
export function useInfiniteAdminUsers(filters: AdminUserFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.usersPage(filters),
    queryFn: ({ pageParam, signal }) => listUsers({ ...filters, page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Fiche détail d'un compte (D33) — requête inactive sans userId. */
export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.userDetail(userId ?? ""),
    queryFn: () => getUserDetail(userId as string),
    enabled: Boolean(userId),
  });
}

/** Profil professionnel d'un candidat (D38) — requête inactive sans userId. */
export function useAdminUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.userProfile(userId ?? ""),
    queryFn: () => getAdminUserProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/** Fiche normalisée d'un candidat (D33) — requête inactive sans userId. */
export function useAdminUserNormalized(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.userNormalized(userId ?? ""),
    queryFn: () => getUserNormalizedProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/**
 * Historique des fiches normalisées d'un candidat (D37) — requête inactive
 * sans userId ; `enabled: false` permet de rester lazy (panneau History
 * ouvert à la demande).
 */
export function useAdminUserNormalizedVersions(
  userId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.admin.userNormalizedVersions(userId ?? ""),
    queryFn: () => getUserNormalizedProfileVersions(userId as string),
    enabled: Boolean(userId) && (options.enabled ?? true),
  });
}

/**
 * Liste globale des offres (D33) en infinite scroll (D34) : filtre statut
 * optionnel, la taille de page reste décidée par le backend (jamais envoyée).
 */
export function useInfiniteAdminJobOffers(status: AdminJobOfferStatus | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.jobOffersPage(status),
    queryFn: ({ pageParam, signal }) =>
      listAllJobOffers({ status, page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 30_000,
  });
}

/** Détail d'une offre côté admin (D33) — requête inactive sans offerId. */
export function useAdminJobOffer(offerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.jobOfferDetail(offerId ?? ""),
    queryFn: () => getAdminJobOffer(offerId as string),
    enabled: Boolean(offerId),
  });
}

/** Fiche normalisée d'une offre (D33) — requête inactive sans offerId. */
export function useAdminOfferNormalized(offerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.jobOfferNormalized(offerId ?? ""),
    queryFn: () => getOfferNormalizedProfile(offerId as string),
    enabled: Boolean(offerId),
  });
}

/**
 * Historique des fiches normalisées d'une offre (D37) — requête inactive sans
 * offerId ; `enabled: false` permet de rester lazy (panneau History ouvert à
 * la demande).
 */
export function useAdminOfferNormalizedVersions(
  offerId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.admin.jobOfferNormalizedVersions(offerId ?? ""),
    queryFn: () => getOfferNormalizedProfileVersions(offerId as string),
    enabled: Boolean(offerId) && (options.enabled ?? true),
  });
}

export function useSkillSuggestions() {
  return useQuery({ queryKey: queryKeys.admin.skillSuggestions, queryFn: listSkillSuggestions });
}

/**
 * Signalements internes d'évaluations IA (D66) en infinite scroll : la taille
 * de page reste décidée par le backend (jamais envoyée). La clé inclut l'admin
 * courant (T-99) : la réponse porte son verdict personnel et ne doit jamais
 * être servie depuis le cache d'un autre compte.
 */
export function useInfiniteAdminCriterionReports() {
  const adminId = useAuthStore((state) => state.user?.id);
  return useInfiniteQuery({
    queryKey: queryKeys.admin.criterionReportsPage(adminId ?? ""),
    queryFn: ({ pageParam, signal }) => listCriterionReports({ page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: Boolean(adminId),
    staleTime: 30_000,
  });
}

/**
 * Dossier d'un signalement (T-86, D66) — requête inactive sans identifiant ou
 * sans admin courant. La clé inclut l'admin (T-97) : le cache d'un compte ne
 * peut jamais servir `myReview` à un autre compte sur le même navigateur.
 */
export function useAdminCriterionReport(reportId: string | undefined) {
  const adminId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: queryKeys.admin.criterionReport(reportId ?? "", adminId ?? ""),
    queryFn: ({ signal }) => getCriterionReport(reportId as string, { signal }),
    enabled: Boolean(reportId && adminId),
    staleTime: 60_000,
  });
}

/**
 * Crée la revue finale de l'admin courant (T-96) : le dossier est mis à jour
 * avec la réponse 201 puis invalidé. Les 409/400 restent dans l'état de la
 * mutation, affichés par la carte — aucun cache n'est modifié avant succès.
 */
export function useCreateCriterionReportReview(reportId: string) {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((state) => state.user?.id);
  const reportKey = queryKeys.admin.criterionReport(reportId, adminId ?? "");
  const listKey = queryKeys.admin.criterionReportsPage(adminId ?? "");

  return useMutation({
    mutationFn: (payload: AdminCriterionReportReviewPayload) =>
      createCriterionReportReview(reportId, payload),
    onSuccess: (review) => {
      queryClient.setQueryData<AdminCriterionReportDetail>(reportKey, (current) =>
        current ? { ...current, myReview: review, canReview: false } : current,
      );
      // Le dossier et la liste portent tous deux le verdict de l'admin
      // courant (T-99) : les deux doivent être relus après une revue.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: reportKey }),
        queryClient.invalidateQueries({ queryKey: listKey }),
      ]);
    },
    onError: (error) => {
      // 409 = avis déjà déposé (autre onglet) ou auto-review : le serveur est
      // la seule source de vérité, on relit le dossier et la liste pour
      // afficher l'état réel au lieu d'un cul-de-sac.
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({ queryKey: reportKey });
        void queryClient.invalidateQueries({ queryKey: listKey });
      }
    },
  });
}

/** Active / désactive un compte, puis rafraîchit la liste des comptes. */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: AdminUser["status"] }) =>
      updateUserStatus(userId, status),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.userDetail(userId) });
    },
  });
}

/** Approbation / lien : la file change et le catalogue peut grandir. */
function invalidateReview(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.skillSuggestions });
  queryClient.invalidateQueries({ queryKey: queryKeys.candidate.referenceSkills });
}

export function useApproveSkillSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category, skillType }: { id: string; category: string; skillType: string }) =>
      approveSkillSuggestion(id, { category, skillType }),
    onSuccess: () => invalidateReview(queryClient),
  });
}

export function useLinkSkillSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, skillId }: { id: string; skillId: string }) => linkSkillSuggestion(id, skillId),
    onSuccess: () => invalidateReview(queryClient),
  });
}

export function useRejectSkillSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rejectSkillSuggestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.skillSuggestions }),
  });
}
