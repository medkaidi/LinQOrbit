import { Badge } from "@/components/ui/badge";

/**
 * Badge de provenance des deux vues normalisées : Declared / Inferred.
 * Absent quand l'entrée ne porte pas d'origin (fiches anciennes, champs LLM
 * optionnels) — jamais de « Declared » par défaut.
 */
export function OriginBadge({ origin }: { origin?: string | null }) {
  if (!origin) {
    return null;
  }
  return (
    <Badge tone={origin === "inferred" ? "neutral" : "success"}>
      {origin === "inferred" ? "Inferred" : "Declared"}
    </Badge>
  );
}
