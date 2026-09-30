import { cn } from "@/lib/utils/cn";

export type IconProps = {
  name: string;
  className?: string;
};

export function Icon({ name, className }: IconProps) {
  return (
    <span aria-hidden="true" className={cn("material-symbols-outlined", className)}>
      {name}
    </span>
  );
}
