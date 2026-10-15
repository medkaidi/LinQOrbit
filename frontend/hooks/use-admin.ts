"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  approveSkillSuggestion,
  getAdminJobOffer,
  getAdminUserProfile,
  getOfferNormalizedProfile,
  getOfferNormalizedProfileVersions,
  getUserDetail,
  getUserNormalizedProfile,
  getUserNormalizedProfileVersions,
  linkSkillSuggestion,
  listAllJobOffers,
  listSkillSuggestions,
  listUsers,
  rejectSkillSuggestion,
  updateUserStatus,
} from "@/lib/api/admin.api";
import type { AdminJobOfferStatus, AdminUser } from "@/types/admin";
import { queryKeys } from "@/hooks/query-keys";

/**
 * Liste des comptes (D34) en infinite scroll : la taille de page reste
 * décidée par le backend (jamais envoyée).
 */
export function useInfiniteAdminUsers() {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.users,
    queryFn: ({ pageParam, signal }) => listUsers({ page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
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
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined,
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
