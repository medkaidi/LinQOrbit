import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/utils/api-error";

type LoadErrorProps = {
  title: string;
  /** Erreur de la requête : le message API s'affiche dans le corps de l'alerte. */
  error: unknown;
  onRetry: () => void;
};

/**
 * Alerte d'échec de chargement d'une zone (tableaux de bord candidat, recruteur,
 * admin) : titre propre à la zone, message de l'API et bouton « Retry » qui
 * relance la requête. Seule définition du motif — les dashboards ne le
 * réécrivent pas.
 */
export function LoadError({ title, error, onRetry }: LoadErrorProps) {
  return (
    <Alert
      variant="error"
      title={title}
      className="mt-0"
      action={
        <Button variant="outline-sm" type="button" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {getApiErrorMessage(error)}
    </Alert>
  );
}
