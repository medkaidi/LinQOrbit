/** Compte tel qu'exposé par l'administration (GET /api/v1/admin/users). */
export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "INACTIVE";
  /** Codes SMALLINT des rôles de capacité (1 = ADMIN). */
  roles: number[];
};

/** Suggestion de compétence en file de revue (GET /api/v1/admin/skill-suggestions). */
export type AdminSkillSuggestion = {
  id: string;
  name: string;
  candidateId: string;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  candidateEmail: string | null;
  createdAt: string;
};
