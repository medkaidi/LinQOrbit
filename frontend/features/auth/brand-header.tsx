import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";

export type BrandHeaderProps = {
  badgeLabel?: string;
};

export function BrandHeader({ badgeLabel = "Recruiter V3.4" }: BrandHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-6 mb-6">
      <div className="flex items-center gap-3">
        <Wordmark className="h-9 w-auto" />
        <div className="w-10 h-10 flex items-center justify-center p-1 rounded-full bg-orange-subtle overflow-hidden">
          <Logo className="w-full h-full" title="LinQOrbit orbital emblem" />
        </div>
      </div>
      <Badge>{badgeLabel}</Badge>
    </div>
  );
}
