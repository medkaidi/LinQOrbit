import type { AuthUser } from "@/types/auth";

/** Codes SMALLINT des rôles de capacité — miroir backend de l'enum `Role`. */
export const ROLE = {
  ADMIN: 1,
} as const;

/**
 * Un compte porte le rôle ADMIN ? Une session persistée avant l'arrivée des
 * rôles (champ `roles` absent) n'est jamais admin.
 */
export function isAdmin(user: Pick<AuthUser, "roles"> | null | undefined): boolean {
  return Boolean(user?.roles?.includes(ROLE.ADMIN));
}
