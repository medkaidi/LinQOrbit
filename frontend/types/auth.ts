/** Compte utilisateur renvoyé par /api/v1/auth (signup, login, me, PUT me). */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** `null` sur un compte qui n'a encore rien renseigné (ex. AdminBootstrap). */
  sex: string | null;
  phone: string | null;
  homeCountry: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  /** Codes SMALLINT des rôles de capacité (1 = ADMIN ; vide = compte simple). */
  roles: number[];
};

/** Réponse de signup / login : jeton + compte. */
export type AuthResponse = {
  token: string;
  user: AuthUser;
};

/** Session persistée par le store Zustand (token + compte). */
export type AuthSession = {
  token: string;
  user: AuthUser;
};
