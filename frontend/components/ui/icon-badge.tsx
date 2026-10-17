import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type IconBadgeTone = "primary" | "secondary";

/** Surfaces douces miroirs de `IndexBadge` : orange (primaire) ou bleu (secondaire). */
const toneClasses: Record<IconBadgeTone, string> = {
  primary: "bg-orange-subtle border-orange-border text-orange-deep",
  secondary: "bg-blue-surface border-blue-border text-blue-deep",
};

/**
 * Pastille d'icône devant un titre de section — même famille que `IndexBadge`
 * avec le glyphe à la place du chiffre. La taille et la graisse du glyphe
 * viennent de la règle `.section-icon` (globals.css, 16px/300).
 */
export function IconBadge({
  icon,
  tone = "secondary",
  className,
}: {
  icon: string;
  tone?: IconBadgeTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "section-icon w-8 h-8 rounded-full border flex items-center justify-center shrink-0",
        toneClasses[tone],
        className,
      )}
    >
      <Icon name={icon} />
    </span>
  );
}
