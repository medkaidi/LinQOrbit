import { api } from "@/lib/api/axios";
import type { AdminSkillSuggestion, AdminUser } from "@/types/admin";

const BASE = "/api/v1/admin";

export async function listUsers(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>(`${BASE}/users`);
  return response.data;
}

export async function updateUserStatus(
  userId: string,
  status: AdminUser["status"],
): Promise<void> {
  await api.patch(`${BASE}/users/${userId}/status`, { status });
}

export async function listSkillSuggestions(): Promise<AdminSkillSuggestion[]> {
  const response = await api.get<AdminSkillSuggestion[]>(`${BASE}/skill-suggestions`);
  return response.data;
}

export async function approveSkillSuggestion(
  id: string,
  body: { category: string; skillType: string },
): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/approve`, body);
}

export async function linkSkillSuggestion(id: string, skillId: string): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/link`, { skillId });
}

export async function rejectSkillSuggestion(id: string): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/reject`);
}
