import { NavPill } from "@/components/ui/nav-pill";

type NewCampaignButtonProps = {
  className?: string;
};

export function NewCampaignButton({ className }: NewCampaignButtonProps) {
  return <NavPill icon="rocket_launch" label="New campaign" className={className} />;
}
