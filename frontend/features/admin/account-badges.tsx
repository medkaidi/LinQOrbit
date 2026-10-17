import { Badge } from "@/components/ui/badge";
import { ROLE } from "@/lib/utils/roles";
import type { AdminUser } from "@/types/admin";

/**
 * Badges de capacité d'un compte (Admin / Candidate / Recruiter) — liste et
 * détail admin, même ordre et mêmes conditions (TD-042).
 */
export function AccountBadges({ account }: { account: AdminUser }) {
  return (
    <>
      {account.roles.includes(ROLE.ADMIN) && <Badge tone="neutral">Admin</Badge>}
      {account.hasCandidateProfile && <Badge tone="neutral">Candidate</Badge>}
      {account.hasRecruiterProfile && <Badge tone="neutral">Recruiter</Badge>}
    </>
  );
}
