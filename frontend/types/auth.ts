/** Compte utilisateur renvoyé par /api/v1/auth (signup, login, me, PUT me). */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sex: string;
  phone: string | null;
  homeCountry: string;
  currentCity: string;
  currentCountry: string;
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
