import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type ReferenceErrorProps = {
  what: string;
  onRetry: () => void;
};

/**
 * Les listes de référence (compétences, langues, diplômes…) viennent du serveur :
 * sans elles une section ne peut pas être remplie, donc on affiche le repli
 * plutôt qu'un select silencieusement vide.
 */
export function ReferenceError({ what, onRetry }: ReferenceErrorProps) {
  return (
    <Alert variant="error" title={`${what} could not be loaded`} className="mt-0 mb-4">
      <span className="flex flex-wrap items-center gap-3">
        The reference lists come from the server.
        <Button variant="outline" type="button" onClick={onRetry}>
          Try again
        </Button>
      </span>
    </Alert>
  );
}
