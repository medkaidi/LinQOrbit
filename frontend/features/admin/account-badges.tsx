import { Badge } from "@/components/ui/badge";
import type { StatusPillTone } from "@/components/ui/status-pill";
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

/**
 * Tons de la pastille de statut de compte — gabarit `StatusPill` partagé : liste des comptes
 * (actif/inactif) et tableau de bord admin (qui compte aussi les comptes suspendus).
 */
export const ACCOUNT_STATUS_TONES: Record<"active" | "inactive" | "suspended", StatusPillTone> = {
  active: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  inactive: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
  suspended: { pill: "bg-error-container text-on-error-container", dot: "bg-error" },
};
