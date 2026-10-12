"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  approveSkillSuggestion,
  linkSkillSuggestion,
  listSkillSuggestions,
  listUsers,
  rejectSkillSuggestion,
  updateUserStatus,
} from "@/lib/api/admin.api";
import type { AdminUser } from "@/types/admin";
import { queryKeys } from "@/hooks/query-keys";

export function useAdminUsers() {
  return useQuery({ queryKey: queryKeys.admin.users, queryFn: listUsers });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users }),
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
