import { isAxiosError } from "axios";

type ProblemDetailBody = {
  detail?: string;
  title?: string;
};

/**
 * Message lisible à partir d'une réponse ProblemDetail (RFC 7807) du backend,
 * avec repli sur le titre puis sur des messages génériques.
 */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Cannot reach the server. Please try again.";
    }
    const data = error.response.data as ProblemDetailBody | undefined;
    if (data?.detail) {
      return data.detail;
    }
    if (data?.title) {
      return data.title;
    }
  }
  return "Something went wrong. Please try again.";
}
