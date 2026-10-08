import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type SpinnerProps = {
  /** Taille/couleur héritées du contexte (les utilitaires `text-*` priment). */
  className?: string;
};

/**
 * Indicateur d'attente unique de la plateforme (glyphe `progress_activity` en
 * rotation) : dans un bouton via la prop `busy`, ou isolé dans un état de
 * chargement. Jamais recopié par les appelants.
 */
export function Spinner({ className }: SpinnerProps) {
  return <Icon name="progress_activity" className={cn("animate-spin", className)} />;
}
