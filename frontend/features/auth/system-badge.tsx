import { Icon } from "@/components/ui/icon";

export function SystemBadge() {
  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-lowest shadow-sm mb-6 transition-all hover:bg-surface-container-low cursor-default">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
      </span>
      <span className="font-label-md text-label-md text-text-secondary">
        LinQOrbit system operational
      </span>
      <span className="text-text-tertiary font-body-sm text-body-sm">•</span>
      <span className="font-label-md text-label-md text-primary-container flex items-center gap-1">
        <Icon name="lock" className="text-[13px]" />
        AES-256
      </span>
    </div>
  );
}
