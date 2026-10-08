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

const USERS_KEY = ["admin", "users"] as const;
const SUGGESTIONS_KEY = ["admin", "skill-suggestions"] as const;
const REFERENCE_SKILLS_KEY = ["candidate", "reference", "skills"] as const;

export function useAdminUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listUsers });
}

export function useSkillSuggestions() {
  return useQuery({ queryKey: SUGGESTIONS_KEY, queryFn: listSkillSuggestions });
}

/** Active / désactive un compte, puis rafraîchit la liste des comptes. */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: AdminUser["status"] }) =>
      updateUserStatus(userId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

/** Approbation / lien : la file change et le catalogue peut grandir. */
function invalidateReview(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
  queryClient.invalidateQueries({ queryKey: REFERENCE_SKILLS_KEY });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY }),
  });
}
